import {
  cargoUsed,
  commitStationBuys,
  goodCondition,
  snapshotVisitedPrices,
  courierCargoUsed,
  courierGoodCondition,
  emptyCargoMap,
} from './state.js?v=z1-20261028ac';
import {
  goodWeightG,
  STOP_REROUTE_UNLOCKED,
  BASE_PRICES,
  GOODS,
  PRICE_DRIFT_INTERVAL_MS,
  PRICE_DRIFT_PCT_MAX,
  PRICE_DRIFT_BAND,
  IMPACT_WINDOW_MS,
  BUY_IMPACT_QTY,
  SELL_IMPACT_QTY,
  BUY_IMPACT_CAP,
  SELL_IMPACT_CAP,
  BUY_IMPACT_STEP,
  SELL_IMPACT_STEP,
  IMPACT_RECOVERY_STEP,
  depleteRateForGood,
  sellMulFromCondition,
  TRANSPORT_QUESTS,
  goodName,
  COURIER_UNLOCK_LOC,
  COURIER_HIRE_COST,
  COURIER_SEED_GOLD,
  COURIER_CAPACITY,
} from './economy-data.js?v=z1-20261028ac';
import { LOCATIONS, distanceBetween, travelMsBetween, TRAIN_SPEED, shortestPath } from './map-data.js?v=z1-20261028ac';

/**
 * @param {import('./state.js').GameState} s
 * @param {number} nowMs
 */

/** Slice N — deplete liquid/volatile condition by distance traveled; waste at 0. */
function depleteConditions(s, distanceDelta) {
  if (!(distanceDelta > 0)) return;
  if (!s.condition) s.condition = {};
  const wasted = [];
  for (const g of GOODS) {
    const qty = s.cargo[g.id] || 0;
    if (qty <= 0) continue;
    const rate = depleteRateForGood(g.id);
    if (!(rate > 0)) continue;
    const cur = s.condition[g.id] != null ? s.condition[g.id] : 100;
    const next = Math.max(0, cur - rate * distanceDelta);
    s.condition[g.id] = next;
    if (next <= 0) {
      s.cargo[g.id] = 0;
      delete s.condition[g.id];
      if (s.buyMp?.[g.id]) delete s.buyMp[g.id];
      if (s.stationBuys?.[g.id]) delete s.stationBuys[g.id];
      wasted.push(g.name);
    }
  }
  // Slice O — quest lot depletes separately; 0% fails quest
  if (s.quest && s.quest.qty > 0) {
    const rate = depleteRateForGood(s.quest.goodId);
    if (rate > 0) {
      s.quest.condition = Math.max(0, (s.quest.condition ?? 100) - rate * distanceDelta);
      if (s.quest.condition <= 0) {
        wasted.push(goodName(s.quest.goodId) + ' (quest)');
        failQuest(s, 'condition');
      }
    }
  }
  if (wasted.length) s._conditionWaste = wasted;
}

/** Deplete courier cargo condition (Slice Q / N). */
function depleteCourierConditions(c, distanceDelta) {
  if (!c || !(distanceDelta > 0)) return;
  if (!c.condition) c.condition = {};
  for (const g of GOODS) {
    const qty = c.cargo[g.id] || 0;
    if (qty <= 0) continue;
    const rate = depleteRateForGood(g.id);
    if (!(rate > 0)) continue;
    const cur = c.condition[g.id] != null ? c.condition[g.id] : 100;
    const next = Math.max(0, cur - rate * distanceDelta);
    c.condition[g.id] = next;
    if (next <= 0) {
      c.cargo[g.id] = 0;
      delete c.condition[g.id];
    }
  }
}

function failQuest(s, reason) {
  s.quest = null;
  s._questMsg = reason === 'condition' ? 'quest failed (cargo wasted)' : 'quest failed';
}

/** One drift step for all (loc, good) quotes around BASE_PRICES. */
function driftPricesOnce(s) {
  for (const loc of LOCATIONS) {
    const baseRow = BASE_PRICES[loc.id];
    if (!baseRow) continue;
    if (!s.prices[loc.id]) s.prices[loc.id] = {};
    for (const g of GOODS) {
      const base = baseRow[g.id];
      if (base == null) continue;
      const cur = s.prices[loc.id][g.id];
      const current = cur != null ? cur : base;
      const lo = Math.max(1, base * (1 - PRICE_DRIFT_BAND));
      const hi = base * (1 + PRICE_DRIFT_BAND);
      const hardLo = Math.max(1, base * (1 - SELL_IMPACT_CAP));
      const hardHi = base * (1 + BUY_IMPACT_CAP);
      let next = current;
      // Recover toward drift band if buy/sell impact pushed outside
      if (current > hi) next = current - base * IMPACT_RECOVERY_STEP;
      else if (current < lo) next = current + base * IMPACT_RECOVERY_STEP;
      else next = current + base * ((Math.random() * 2 - 1) * PRICE_DRIFT_PCT_MAX);
      if (next < hardLo) next = hardLo;
      if (next > hardHi) next = hardHi;
      // Inside normal band, soft-clamp drift
      if (current >= lo && current <= hi) {
        if (next < lo) next = lo;
        if (next > hi) next = hi;
      }
      s.prices[loc.id][g.id] = Math.max(1, Math.round(next));
    }
  }
}

export function tick(s, nowMs) {
  const rawDt = Math.max(0, nowMs - s.nowMs);
  s.nowMs = nowMs;
  if (s.travel) {
    s.travel.elapsedMs += rawDt;
    const speed = s.travel.speed || 0;
    const dist = s.travel.distance || 0;
    const prevTr = s.travel.traveledDistance != null ? s.travel.traveledDistance : 0;
    s.travel.traveledDistance = Math.min(dist, speed * (s.travel.elapsedMs / 1000));
    const dDist = Math.max(0, s.travel.traveledDistance - prevTr);
    if (dDist > 0) depleteConditions(s, dDist);
    if (s.travel.elapsedMs >= s.travel.durationMs) {
      s.locationId = s.travel.to;
      s.selectedLocId = s.travel.to;
      s.travel = null;
      snapshotVisitedPrices(s, s.locationId); // Slice P — arrive snapshot
    }
  }
  tickCourier(s, rawDt);
  // Slice L — price slow-drift every ~5s
  if (!s.lastPriceDriftMs) s.lastPriceDriftMs = nowMs;
  while (nowMs - s.lastPriceDriftMs >= PRICE_DRIFT_INTERVAL_MS) {
    s.lastPriceDriftMs += PRICE_DRIFT_INTERVAL_MS;
    driftPricesOnce(s);
  }
}

/** Advance courier travel + stop trades. */
function tickCourier(s, rawDt) {
  const c = s.courier;
  if (!c) return;
  if (c.paused) return;
  if (c.travel) {
    c.travel.elapsedMs += rawDt;
    const speed = c.travel.speed || 0;
    const dist = c.travel.distance || 0;
    const prevTr = c.travel.traveledDistance != null ? c.travel.traveledDistance : 0;
    c.travel.traveledDistance = Math.min(dist, speed * (c.travel.elapsedMs / 1000));
    const dDist = Math.max(0, c.travel.traveledDistance - prevTr);
    if (dDist > 0) depleteCourierConditions(c, dDist);
    if (c.travel.elapsedMs >= c.travel.durationMs) {
      const arrived = c.travel.to;
      const finalDest = c.travel.finalDest || arrived;
      c.locationId = arrived;
      c.travel = null;
      if (arrived === finalDest) {
        runCourierStopTrades(s, c);
        advanceCourierRoute(s, c);
      } else {
        // intermediate hop toward finalDest
        startCourierTravel(s, c, finalDest);
      }
      s._courierArrived = true;
    }
    return;
  }
  // docked — ensure we have a trip if route allows
  if (!c.paused && c.route && c.route.length >= 2) {
    const dest = c.route[c.routeIndex % c.route.length];
    if (dest && dest !== c.locationId) startCourierTravel(s, c, dest);
  }
}

/** Sell-first then buy at docked stop per trade checkboxes. */
function runCourierStopTrades(s, c) {
  const locId = c.locationId;
  const perStop = c.trade?.[locId] || {};
  // sell first so gold frees for buys
  for (const g of GOODS) {
    const flags = perStop[g.id];
    if (!flags || !flags.sell) continue;
    const qty = c.cargo[g.id] || 0;
    if (qty > 0) courierTrySell(s, c, locId, g.id, qty);
  }
  for (const g of GOODS) {
    const flags = perStop[g.id];
    if (!flags || !flags.buy) continue;
    courierBuyMax(s, c, locId, g.id);
  }
}

function advanceCourierRoute(s, c) {
  if (!c.route || c.route.length < 2) return;
  c.routeIndex = (c.routeIndex + 1) % c.route.length;
  const dest = c.route[c.routeIndex];
  if (dest && dest !== c.locationId) startCourierTravel(s, c, dest);
}

/**
 * Start (or continue) travel toward destId via next unlocked hop.
 * @param {import('./state.js').GameState} s
 * @param {import('./state.js').CourierState} c
 * @param {string} destId
 */
function startCourierTravel(s, c, destId) {
  if (!destId || destId === c.locationId) return;
  const path = shortestPath(c.locationId, destId, s.unlocked);
  if (!path || path.length < 2) return;
  const nextHop = path[1];
  const dist = distanceBetween(c.locationId, nextHop);
  const ms = travelMsBetween(c.locationId, nextHop, TRAIN_SPEED);
  if (dist == null || ms == null) return;
  c.travel = {
    from: c.locationId,
    to: nextHop,
    elapsedMs: 0,
    durationMs: ms,
    distance: dist,
    speed: TRAIN_SPEED,
    traveledDistance: 0,
    finalDest: destId,
  };
}

function courierTrySell(s, c, locId, goodId, qty) {
  const price = s.prices[locId]?.[goodId];
  if (price == null) return;
  qty = Math.floor(qty);
  if (qty <= 0) return;
  if ((c.cargo[goodId] || 0) < qty) return;
  const cond = courierGoodCondition(c, goodId);
  const mul = sellMulFromCondition(cond);
  if (mul <= 0) return;
  const unit = Math.max(0, Math.round(price * mul));
  c.cargo[goodId] -= qty;
  c.gold += unit * qty;
  if ((c.cargo[goodId] || 0) <= 0 && c.condition) delete c.condition[goodId];
  recordTradeImpact(s, locId, goodId, qty, 'sell');
}

function courierBuyMax(s, c, locId, goodId) {
  const price = s.prices[locId]?.[goodId];
  if (price == null || !(price > 0)) return;
  const w = goodWeightG(goodId);
  if (!(w > 0)) return;
  const byGold = Math.floor(c.gold / price);
  const byCap = Math.floor((c.capacity - courierCargoUsed(c)) / w);
  const qty = Math.max(0, Math.min(byGold, byCap));
  if (qty <= 0) return;
  const cost = price * qty;
  c.gold -= cost;
  const had = c.cargo[goodId] || 0;
  if (!c.condition) c.condition = {};
  if (depleteRateForGood(goodId) > 0) {
    const oldC = had > 0 && c.condition[goodId] != null ? c.condition[goodId] : 100;
    c.condition[goodId] = had + qty > 0 ? (oldC * had + 100 * qty) / (had + qty) : 100;
  }
  c.cargo[goodId] = had + qty;
  recordTradeImpact(s, locId, goodId, qty, 'buy');
}

function impactKey(locId, goodId) {
  return locId + '|' + goodId;
}

function pruneImpactBucket(bucket, nowMs) {
  const cut = nowMs - IMPACT_WINDOW_MS;
  bucket.buys = (bucket.buys || []).filter((e) => e.t >= cut);
  bucket.sells = (bucket.sells || []).filter((e) => e.t >= cut);
}

function sumQty(list) {
  let n = 0;
  for (const e of list) n += e.qty;
  return n;
}

/** Record trade + apply buy/sell impact when window volume exceeds threshold. */
function recordTradeImpact(s, locId, goodId, qty, side) {
  if (!s.tradeImpact) s.tradeImpact = {};
  const key = impactKey(locId, goodId);
  const bucket = s.tradeImpact[key] || { buys: [], sells: [] };
  const now = s.nowMs || 0;
  pruneImpactBucket(bucket, now);
  if (side === 'buy') bucket.buys.push({ t: now, qty });
  else bucket.sells.push({ t: now, qty });
  s.tradeImpact[key] = bucket;

  const base = BASE_PRICES[locId]?.[goodId];
  if (base == null) return;
  if (!s.prices[locId]) s.prices[locId] = {};
  let cur = s.prices[locId][goodId];
  if (cur == null) cur = base;

  if (side === 'buy') {
    const vol = sumQty(bucket.buys);
    if (vol <= BUY_IMPACT_QTY) return;
    const cap = Math.round(base * (1 + BUY_IMPACT_CAP));
    if (cur >= cap) return;
    const step = Math.max(1, Math.round(base * BUY_IMPACT_STEP));
    s.prices[locId][goodId] = Math.min(cap, cur + step);
  } else {
    const vol = sumQty(bucket.sells);
    if (vol <= SELL_IMPACT_QTY) return;
    const floor = Math.max(1, Math.round(base * (1 - SELL_IMPACT_CAP)));
    if (cur <= floor) return;
    const step = Math.max(1, Math.round(base * SELL_IMPACT_STEP));
    s.prices[locId][goodId] = Math.max(floor, cur - step);
  }
}

/**
 * @param {import('./state.js').GameState} s
 * @param {string} locId
 * @param {string} goodId
 * @param {number} qty
 */
export function tryBuy(s, locId, goodId, qty) {
  if (s.travel) return { ok: false, reason: 'traveling' };
  if (s.locationId !== locId) return { ok: false, reason: 'not_here' };
  if (!s.unlocked.includes(locId)) return { ok: false, reason: 'locked' };
  const price = s.prices[locId]?.[goodId];
  if (price == null) return { ok: false, reason: 'no_quote' };
  qty = Math.floor(qty);
  if (qty <= 0) return { ok: false, reason: 'qty' };
  const cost = price * qty;
  if (s.gold < cost) return { ok: false, reason: 'gold' };
  const w = goodWeightG(goodId);
  if (!(w > 0)) return { ok: false, reason: 'weight' };
  if (cargoUsed(s) + w * qty > s.capacity) return { ok: false, reason: 'capacity' };
  s.gold -= cost;
  const had = s.cargo[goodId] || 0;
  if (!s.condition) s.condition = {};
  if (depleteRateForGood(goodId) > 0) {
    const oldC = had > 0 && s.condition[goodId] != null ? s.condition[goodId] : 100;
    const newC = had + qty > 0 ? (oldC * had + 100 * qty) / (had + qty) : 100;
    s.condition[goodId] = newC;
  }
  s.cargo[goodId] = had + qty;
  // Slice G: save buy MP into this station visit (avg committed on leave)
  if (!s.stationBuys) s.stationBuys = {};
  const sb = s.stationBuys[goodId] || { sum: 0, qty: 0 };
  sb.sum += price * qty;
  sb.qty += qty;
  s.stationBuys[goodId] = sb;
  recordTradeImpact(s, locId, goodId, qty, 'buy');
  return { ok: true };
}

/**
 * @param {import('./state.js').GameState} s
 * @param {string} locId
 * @param {string} goodId
 * @param {number} qty
 */
export function trySell(s, locId, goodId, qty) {
  if (s.travel) return { ok: false, reason: 'traveling' };
  if (s.locationId !== locId) return { ok: false, reason: 'not_here' };
  if (!s.unlocked.includes(locId)) return { ok: false, reason: 'locked' };
  const price = s.prices[locId]?.[goodId];
  if (price == null) return { ok: false, reason: 'no_quote' };
  qty = Math.floor(qty);
  if (qty <= 0) return { ok: false, reason: 'qty' };
  if ((s.cargo[goodId] || 0) < qty) return { ok: false, reason: 'stock' };
  const cond = goodCondition(s, goodId);
  const mul = sellMulFromCondition(cond);
  if (mul <= 0) return { ok: false, reason: 'waste' };
  const unit = Math.max(0, Math.round(price * mul));
  s.cargo[goodId] -= qty;
  s.gold += unit * qty;
  if ((s.cargo[goodId] || 0) <= 0 && s.condition) delete s.condition[goodId];
  // Keep buyMp in sync with remaining cargo (FIFO-ish qty shrink)
  if (s.buyMp?.[goodId]) {
    s.buyMp[goodId].qty = Math.max(0, s.buyMp[goodId].qty - qty);
    if (s.buyMp[goodId].qty <= 0) delete s.buyMp[goodId];
  }
  if (s.stationBuys?.[goodId]) {
    const cargoLeft = s.cargo[goodId] || 0;
    const committedQty = s.buyMp?.[goodId]?.qty || 0;
    const maxPend = Math.max(0, cargoLeft - committedQty);
    if (s.stationBuys[goodId].qty > maxPend) {
      const keep = maxPend;
      if (keep <= 0) delete s.stationBuys[goodId];
      else {
        const unitAvg = s.stationBuys[goodId].sum / s.stationBuys[goodId].qty;
        s.stationBuys[goodId] = { qty: keep, sum: unitAvg * keep };
      }
    }
  }
  recordTradeImpact(s, locId, goodId, qty, 'sell');
  return { ok: true };
}

/**
 * @param {import('./state.js').GameState} s
 * @param {string} toId
 * @param {number} durationMs
 * @param {{ distance?: number, speed?: number }} [meta]
 */
export function tryTravel(s, toId, durationMs, meta = {}) {
  if (s.travel) return { ok: false, reason: 'traveling' };
  if (!s.unlocked.includes(toId)) return { ok: false, reason: 'locked' };
  if (toId === s.locationId) return { ok: false, reason: 'same' };
  if (durationMs == null || durationMs <= 0) return { ok: false, reason: 'no_edge' };
  commitStationBuys(s);
  snapshotVisitedPrices(s, s.locationId); // Slice P — leave snapshot
  const distance = meta.distance != null ? meta.distance : 0;
  const speed = meta.speed != null ? meta.speed : 0;
  s.travel = {
    from: s.locationId,
    to: toId,
    elapsedMs: 0,
    durationMs,
    distance,
    speed,
    traveledDistance: 0,
  };
  return { ok: true };
}

/**
 * @param {import('./state.js').GameState} s
 * @param {{ target: string, costs: { goodId: string, qty: number }[] }} unlock
 */
export function tryUnlock(s, unlock) {
  if (s.travel) return { ok: false, reason: 'traveling' };
  if (!s.unlocked.includes(s.locationId)) return { ok: false, reason: 'locked_here' };
  if (s.unlocked.includes(unlock.target)) return { ok: false, reason: 'already' };
  for (const c of unlock.costs) {
    if ((s.cargo[c.goodId] || 0) < c.qty) return { ok: false, reason: 'need_' + c.goodId };
  }
  for (const c of unlock.costs) s.cargo[c.goodId] -= c.qty;
  s.unlocked.push(unlock.target);
  return { ok: true };
}


/** Mid-travel stop — gated by STOP_REROUTE_UNLOCKED. Stays at travel.from. */
export function tryStopTravel(s) {
  if (!s.travel) return { ok: false, reason: 'not_traveling' };
  if (!STOP_REROUTE_UNLOCKED) return { ok: false, reason: 'locked_feature' };
  s.travel = null;
  return { ok: true };
}

/**
 * Mid-travel re-route to toId (from current locationId / travel.from).
 * Gated by STOP_REROUTE_UNLOCKED.
 * @param {number} durationMs
 * @param {{ distance?: number, speed?: number }} [meta]
 */
export function tryReroute(s, toId, durationMs, meta = {}) {
  if (!s.travel) return { ok: false, reason: 'not_traveling' };
  if (!STOP_REROUTE_UNLOCKED) return { ok: false, reason: 'locked_feature' };
  if (!s.unlocked.includes(toId)) return { ok: false, reason: 'locked' };
  const fromId = s.locationId; // still at origin until arrive
  if (toId === fromId) {
    s.travel = null;
    return { ok: true, stopped: true };
  }
  if (toId === s.travel.to) return { ok: false, reason: 'same_dest' };
  if (durationMs == null || durationMs <= 0) return { ok: false, reason: 'no_edge' };
  const distance = meta.distance != null ? meta.distance : 0;
  const speed = meta.speed != null ? meta.speed : 0;
  s.travel = {
    from: fromId,
    to: toId,
    elapsedMs: 0,
    durationMs,
    distance,
    speed,
    traveledDistance: 0,
  };
  return { ok: true };
}

/** Offer definition at loc if any. */
export function questOfferAt(locId) {
  return TRANSPORT_QUESTS[locId] || null;
}

/**
 * Accept transport quest at current station (one at a time).
 * Dedicated quest lot — not sellable trade cargo.
 */
export function tryAcceptQuest(s) {
  if (s.travel) return { ok: false, reason: 'traveling' };
  if (s.quest) return { ok: false, reason: 'quest_active' };
  const offer = TRANSPORT_QUESTS[s.locationId];
  if (!offer) return { ok: false, reason: 'no_offer' };
  if (!s.unlocked.includes(offer.to)) return { ok: false, reason: 'dest_locked' };
  const w = goodWeightG(offer.goodId) * offer.qty;
  if (cargoUsed(s) + w > s.capacity) return { ok: false, reason: 'capacity' };
  s.quest = {
    from: s.locationId,
    to: offer.to,
    goodId: offer.goodId,
    qty: offer.qty,
    rewardGold: offer.rewardGold,
    condition: 100,
  };
  return { ok: true };
}

/** Deliver at destination if condition > 0. */
export function tryDeliverQuest(s) {
  if (s.travel) return { ok: false, reason: 'traveling' };
  if (!s.quest) return { ok: false, reason: 'no_quest' };
  if (s.locationId !== s.quest.to) return { ok: false, reason: 'wrong_station' };
  if (!(s.quest.condition > 0) || !(s.quest.qty > 0)) {
    failQuest(s, 'condition');
    return { ok: false, reason: 'waste' };
  }
  const pay = s.quest.rewardGold;
  s.gold += pay;
  s.quest = null;
  return { ok: true, reward: pay };
}

/** Abandon / dump quest cargo (counts as fail). */
export function tryAbandonQuest(s) {
  if (!s.quest) return { ok: false, reason: 'no_quest' };
  failQuest(s, 'abandon');
  return { ok: true };
}

// ——— Slice Q: courier ———

/** Hire Zone1 courier once Star Ash is unlocked. Free hire (COURIER_HIRE_COST=0). */
export function tryHireCourier(s) {
  if (s.courier) return { ok: false, reason: 'already' };
  if (!s.unlocked.includes(COURIER_UNLOCK_LOC)) return { ok: false, reason: 'locked' };
  if (COURIER_HIRE_COST > 0 && s.gold < COURIER_HIRE_COST) return { ok: false, reason: 'gold' };
  if (COURIER_HIRE_COST > 0) s.gold -= COURIER_HIRE_COST;

  const route = LOCATIONS.map((l) => l.id).filter((id) => s.unlocked.includes(id));
  /** @type {Record<string, Record<string, { buy: boolean, sell: boolean }>>} */
  const trade = {};
  for (const locId of route) {
    trade[locId] = {};
    for (const g of GOODS) trade[locId][g.id] = { buy: false, sell: false };
  }

  const startLoc = s.locationId;
  s.courier = {
    locationId: startLoc,
    gold: COURIER_SEED_GOLD,
    capacity: COURIER_CAPACITY,
    cargo: emptyCargoMap(),
    condition: {},
    route: [...route],
    routeIndex: 0,
    trade,
    travel: null,
    paused: false,
  };

  // Point routeIndex at next stop after start (if start is in route)
  const c = s.courier;
  const atIdx = c.route.indexOf(startLoc);
  if (atIdx >= 0 && c.route.length >= 2) {
    c.routeIndex = (atIdx + 1) % c.route.length;
    startCourierTravel(s, c, c.route[c.routeIndex]);
  } else if (c.route.length >= 2) {
    c.routeIndex = 0;
    if (c.route[0] !== startLoc) startCourierTravel(s, c, c.route[0]);
    else {
      c.routeIndex = 1 % c.route.length;
      startCourierTravel(s, c, c.route[c.routeIndex]);
    }
  }
  return { ok: true };
}

export function trySetCourierPaused(s, paused) {
  if (!s.courier) return { ok: false, reason: 'no_courier' };
  s.courier.paused = !!paused;
  if (!s.courier.paused && !s.courier.travel && s.courier.route.length >= 2) {
    const dest = s.courier.route[s.courier.routeIndex % s.courier.route.length];
    if (dest && dest !== s.courier.locationId) startCourierTravel(s, s.courier, dest);
  }
  return { ok: true };
}

/** Replace route with unlocked loc ids (min 2 to run). Clears travel; restarts toward first. */
export function trySetCourierRoute(s, routeIds) {
  if (!s.courier) return { ok: false, reason: 'no_courier' };
  const cleaned = [];
  for (const id of routeIds) {
    if (!s.unlocked.includes(id)) continue;
    if (cleaned.includes(id)) continue;
    cleaned.push(id);
  }
  if (cleaned.length < 1) return { ok: false, reason: 'empty' };
  const c = s.courier;
  c.route = cleaned;
  c.travel = null;
  // ensure trade rows exist
  if (!c.trade) c.trade = {};
  for (const locId of cleaned) {
    if (!c.trade[locId]) {
      c.trade[locId] = {};
      for (const g of GOODS) c.trade[locId][g.id] = { buy: false, sell: false };
    }
  }
  if (cleaned.length < 2) {
    c.routeIndex = 0;
    return { ok: true, docked: true };
  }
  // next target: first stop that isn't current, else index 0 cycling
  let idx = cleaned.indexOf(c.locationId);
  if (idx < 0) idx = -1;
  c.routeIndex = (idx + 1) % cleaned.length;
  if (!c.paused) startCourierTravel(s, c, cleaned[c.routeIndex]);
  return { ok: true };
}

export function trySetCourierTradeFlag(s, locId, goodId, side, value) {
  if (!s.courier) return { ok: false, reason: 'no_courier' };
  if (!s.unlocked.includes(locId)) return { ok: false, reason: 'locked' };
  if (!GOODS.some((g) => g.id === goodId)) return { ok: false, reason: 'good' };
  if (side !== 'buy' && side !== 'sell') return { ok: false, reason: 'side' };
  const c = s.courier;
  if (!c.trade) c.trade = {};
  if (!c.trade[locId]) {
    c.trade[locId] = {};
    for (const g of GOODS) c.trade[locId][g.id] = { buy: false, sell: false };
  }
  if (!c.trade[locId][goodId]) c.trade[locId][goodId] = { buy: false, sell: false };
  c.trade[locId][goodId][side] = !!value;
  return { ok: true };
}

/**
 * Transfer gold between player and courier when co-located docked.
 * @param {'toCourier'|'toPlayer'} dir
 */
export function tryTransferGold(s, dir, amount) {
  const c = s.courier;
  if (!c) return { ok: false, reason: 'no_courier' };
  if (s.travel || c.travel) return { ok: false, reason: 'traveling' };
  if (c.locationId !== s.locationId) return { ok: false, reason: 'apart' };
  amount = Math.floor(Number(amount));
  if (!(amount > 0)) return { ok: false, reason: 'qty' };
  if (dir === 'toCourier') {
    if (s.gold < amount) return { ok: false, reason: 'gold' };
    s.gold -= amount;
    c.gold += amount;
  } else if (dir === 'toPlayer') {
    if (c.gold < amount) return { ok: false, reason: 'gold' };
    c.gold -= amount;
    s.gold += amount;
  } else {
    return { ok: false, reason: 'dir' };
  }
  return { ok: true };
}

/**
 * Transfer goods either way when co-located docked.
 * @param {'toCourier'|'toPlayer'} dir
 */
export function tryTransferGood(s, goodId, dir, qty) {
  const c = s.courier;
  if (!c) return { ok: false, reason: 'no_courier' };
  if (s.travel || c.travel) return { ok: false, reason: 'traveling' };
  if (c.locationId !== s.locationId) return { ok: false, reason: 'apart' };
  if (!GOODS.some((g) => g.id === goodId)) return { ok: false, reason: 'good' };
  qty = Math.floor(Number(qty));
  if (!(qty > 0)) return { ok: false, reason: 'qty' };
  const w = goodWeightG(goodId);
  if (!(w > 0)) return { ok: false, reason: 'weight' };

  if (dir === 'toCourier') {
    if ((s.cargo[goodId] || 0) < qty) return { ok: false, reason: 'stock' };
    if (courierCargoUsed(c) + w * qty > c.capacity) return { ok: false, reason: 'capacity' };
    // move with blended condition
    const hadP = s.cargo[goodId] || 0;
    const hadC = c.cargo[goodId] || 0;
    const pCond = depleteRateForGood(goodId) > 0
      ? (s.condition?.[goodId] != null ? s.condition[goodId] : 100)
      : null;
    s.cargo[goodId] = hadP - qty;
    if ((s.cargo[goodId] || 0) <= 0 && s.condition) delete s.condition[goodId];
    c.cargo[goodId] = hadC + qty;
    if (pCond != null) {
      if (!c.condition) c.condition = {};
      const oldC = hadC > 0 && c.condition[goodId] != null ? c.condition[goodId] : 100;
      c.condition[goodId] = (oldC * hadC + pCond * qty) / (hadC + qty);
    }
  } else if (dir === 'toPlayer') {
    if ((c.cargo[goodId] || 0) < qty) return { ok: false, reason: 'stock' };
    if (cargoUsed(s) + w * qty > s.capacity) return { ok: false, reason: 'capacity' };
    const hadC = c.cargo[goodId] || 0;
    const hadP = s.cargo[goodId] || 0;
    const cCond = depleteRateForGood(goodId) > 0
      ? (c.condition?.[goodId] != null ? c.condition[goodId] : 100)
      : null;
    c.cargo[goodId] = hadC - qty;
    if ((c.cargo[goodId] || 0) <= 0 && c.condition) delete c.condition[goodId];
    s.cargo[goodId] = hadP + qty;
    if (cCond != null) {
      if (!s.condition) s.condition = {};
      const oldP = hadP > 0 && s.condition[goodId] != null ? s.condition[goodId] : 100;
      s.condition[goodId] = (oldP * hadP + cCond * qty) / (hadP + qty);
    }
  } else {
    return { ok: false, reason: 'dir' };
  }
  return { ok: true };
}
