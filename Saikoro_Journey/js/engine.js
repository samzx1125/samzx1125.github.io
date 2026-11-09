import {
  cargoUsed,
  commitStationBuys,
  goodCondition,
  snapshotVisitedPrices,
  courierCargoUsed,
  courierGoodCondition,
  emptyStacks,
  ensureWarehouse,
  warehouseUsed,
  warehouseKeyAtPlayer,
  playerAtWarehouse,
  courierAtWarehouse,
  allocStackId,
  addToStacks,
  removeFromStack,
  removeFromStacksFifo,
  stacksQtyOf,
  findStack,
  normalizeUnitPrice,
} from './state.js?v=z1-20261028cf';
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
  effectiveDepleteRate,
  sellMulFromCondition,
  TRANSPORT_QUESTS,
  goodName,
  COURIER_UNLOCK_LOC,
  UNIVERSAL_COURIER_UNLOCK_LOC,
  COURIER_HIRE_COST,
  COURIER_SEED_GOLD,
  COURIER_CAPACITY,
  CAPACITY_MAX_LEVEL,
  effectiveCapacity,
  capacityUpgradeCost,
  PRESERVE_MAX_LEVEL,
  preserveUpgradeCost,
  SPEED_MAX_LEVEL,
  speedUpgradeCost,
  effectiveSpeed,
  AREA1_WAREHOUSE_LOC,
  AREA1_WAREHOUSE_CAP,
  AREA2_WAREHOUSE_LOC,
  WAREHOUSE_CAP,
  areaPropertyForLoc,
  areaBridgeBlockReason,
  travelFreightCost,
} from './economy-data.js?v=z1-20261028cf';
import { LOCATIONS, distanceBetween, travelMsBetween, shortestPath, isZone1Loc, areaOfLoc } from './map-data.js?v=z1-20261028cf';
import { KEY_FOG_WELL_SCRAP, KEY_MIST_SPUR_SCRAP, KEY_EXIT_ASH_SCRAP, KEY_COBALT_GATE_SCRAP, KEY_QUIET_PIER_SCRAP } from './personal-data.js?v=z1-20261028cf';

/**
 * @param {import('./state.js').GameState} s
 * @param {number} nowMs
 */

/** Slice N/Z/AE — deplete liquid/volatile condition per stack; preserveLevel slows drain. */
function depleteConditions(s, distanceDelta) {
  if (!(distanceDelta > 0)) return;
  if (!Array.isArray(s.cargoStacks)) s.cargoStacks = [];
  const wasted = [];
  const pl = s.preserveLevel | 0;
  const names = new Set();
  for (let i = 0; i < s.cargoStacks.length; ) {
    const st = s.cargoStacks[i];
    if (!st || !(st.qty > 0)) {
      s.cargoStacks.splice(i, 1);
      continue;
    }
    const rate = effectiveDepleteRate(st.goodId, pl);
    if (!(rate > 0)) {
      i += 1;
      continue;
    }
    const cur = st.condition != null ? st.condition : 100;
    const next = Math.max(0, cur - rate * distanceDelta);
    st.condition = next;
    if (next <= 0) {
      names.add(goodName(st.goodId));
      s.cargoStacks.splice(i, 1);
      continue;
    }
    i += 1;
  }
  for (const n of names) wasted.push(n);
  // Slice O — quest lot depletes separately; 0% fails quest
  if (s.quest && s.quest.qty > 0) {
    const rate = effectiveDepleteRate(s.quest.goodId, pl);
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

/** Deplete courier cargo stacks (Slice Q/N/Z/AE). Uses player preserveLevel. */
function depleteCourierConditions(c, distanceDelta, preserveLevel) {
  if (!c || !(distanceDelta > 0)) return;
  if (!Array.isArray(c.cargoStacks)) c.cargoStacks = [];
  const pl = preserveLevel | 0;
  for (let i = 0; i < c.cargoStacks.length; ) {
    const st = c.cargoStacks[i];
    if (!st || !(st.qty > 0)) {
      c.cargoStacks.splice(i, 1);
      continue;
    }
    const rate = effectiveDepleteRate(st.goodId, pl);
    if (!(rate > 0)) {
      i += 1;
      continue;
    }
    const cur = st.condition != null ? st.condition : 100;
    const next = Math.max(0, cur - rate * distanceDelta);
    st.condition = next;
    if (next <= 0) {
      c.cargoStacks.splice(i, 1);
      continue;
    }
    i += 1;
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
    const driftAmp = areaPropertyForLoc(loc.id).driftAmp ?? 1;
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
      // Recover toward drift band if buy/sell impact pushed outside (amp softens/hardens step lightly)
      if (current > hi) next = current - base * IMPACT_RECOVERY_STEP * driftAmp;
      else if (current < lo) next = current + base * IMPACT_RECOVERY_STEP * driftAmp;
      else next = current + base * ((Math.random() * 2 - 1) * PRICE_DRIFT_PCT_MAX * driftAmp);
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
    if (dDist > 0) depleteCourierConditions(c, dDist, s.preserveLevel);
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
  // sell first so gold frees for buys — FIFO per good across stacks
  for (const g of GOODS) {
    const flags = perStop[g.id];
    if (!flags || !flags.sell) continue;
    const qty = stacksQtyOf(c.cargoStacks, g.id);
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
  const spd = effectiveSpeed(s.speedLevel);
  const ms = travelMsBetween(c.locationId, nextHop, spd);
  if (dist == null || ms == null) return;
  c.travel = {
    from: c.locationId,
    to: nextHop,
    elapsedMs: 0,
    durationMs: ms,
    distance: dist,
    speed: spd,
    traveledDistance: 0,
    finalDest: destId,
  };
}

function courierTrySell(s, c, locId, goodId, qty) {
  const price = s.prices[locId]?.[goodId];
  if (price == null) return;
  qty = Math.floor(qty);
  if (qty <= 0) return;
  if (!Array.isArray(c.cargoStacks)) c.cargoStacks = [];
  if (stacksQtyOf(c.cargoStacks, goodId) < qty) return;
  // Sell FIFO stacks; each stack uses its own condition for MP mul
  let left = qty;
  let sold = 0;
  while (left > 0) {
    const st = (c.cargoStacks || []).find((x) => x && x.goodId === goodId && x.qty > 0);
    if (!st) break;
    const take = Math.min(st.qty | 0, left);
    const cond = st.condition != null ? st.condition : 100;
    const mul = sellMulFromCondition(cond);
    if (mul <= 0) {
      // waste stack — drop it
      const idx = c.cargoStacks.indexOf(st);
      if (idx >= 0) c.cargoStacks.splice(idx, 1);
      continue;
    }
    const unit = Math.max(0, Math.round(price * mul));
    c.gold += unit * take;
    st.qty = (st.qty | 0) - take;
    if (st.qty <= 0) {
      const idx = c.cargoStacks.indexOf(st);
      if (idx >= 0) c.cargoStacks.splice(idx, 1);
    }
    sold += take;
    left -= take;
  }
  if (sold > 0) recordTradeImpact(s, locId, goodId, sold, 'sell');
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
  if (!Array.isArray(c.cargoStacks)) c.cargoStacks = [];
  // Courier shares player's nextStackId allocator via game state
  addToStacks(c.cargoStacks, { goodId, unitPrice: price, qty, condition: 100 }, () => allocStackId(s));
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
  const unitPrice = normalizeUnitPrice(price);
  const cost = unitPrice * qty;
  if (s.gold < cost) return { ok: false, reason: 'gold' };
  const w = goodWeightG(goodId);
  if (!(w > 0)) return { ok: false, reason: 'weight' };
  if (cargoUsed(s) + w * qty > s.capacity) return { ok: false, reason: 'capacity' };
  s.gold -= cost;
  if (!Array.isArray(s.cargoStacks)) s.cargoStacks = [];
  // Slice AE: commit unitPrice into stack immediately (merge only same goodId+unitPrice)
  addToStacks(
    s.cargoStacks,
    { goodId, unitPrice, qty, condition: 100 },
    () => allocStackId(s),
  );
  recordTradeImpact(s, locId, goodId, qty, 'buy');
  return { ok: true };
}

/**
 * Sell from a specific stack (preferred) or FIFO by goodId when stackId omitted.
 * @param {import('./state.js').GameState} s
 * @param {string} locId
 * @param {string} goodId
 * @param {number} qty
 * @param {string} [stackId]
 */
export function trySell(s, locId, goodId, qty, stackId) {
  if (s.travel) return { ok: false, reason: 'traveling' };
  if (s.locationId !== locId) return { ok: false, reason: 'not_here' };
  if (!s.unlocked.includes(locId)) return { ok: false, reason: 'locked' };
  const price = s.prices[locId]?.[goodId];
  if (price == null) return { ok: false, reason: 'no_quote' };
  qty = Math.floor(qty);
  if (qty <= 0) return { ok: false, reason: 'qty' };
  if (!Array.isArray(s.cargoStacks)) s.cargoStacks = [];

  let sold = 0;
  let goldGain = 0;

  if (stackId) {
    const st = findStack(s.cargoStacks, stackId);
    if (!st || st.goodId !== goodId) return { ok: false, reason: 'stack' };
    if ((st.qty | 0) < qty) return { ok: false, reason: 'stock' };
    const cond = st.condition != null ? st.condition : 100;
    const mul = sellMulFromCondition(cond);
    if (mul <= 0) return { ok: false, reason: 'waste' };
    const unit = Math.max(0, Math.round(price * mul));
    const removed = removeFromStack(s.cargoStacks, stackId, qty);
    if (!removed) return { ok: false, reason: 'stock' };
    sold = qty;
    goldGain = unit * qty;
  } else {
    // FIFO by stack order — each stack sells at its own condition (no price averaging)
    let left = qty;
    if (stacksQtyOf(s.cargoStacks, goodId) < qty) return { ok: false, reason: 'stock' };
    while (left > 0) {
      const st = s.cargoStacks.find((x) => x && x.goodId === goodId && x.qty > 0);
      if (!st) break;
      const take = Math.min(st.qty | 0, left);
      const cond = st.condition != null ? st.condition : 100;
      const mul = sellMulFromCondition(cond);
      if (mul <= 0) {
        const idx = s.cargoStacks.indexOf(st);
        if (idx >= 0) s.cargoStacks.splice(idx, 1);
        continue;
      }
      const unit = Math.max(0, Math.round(price * mul));
      removeFromStack(s.cargoStacks, st.id, take);
      goldGain += unit * take;
      sold += take;
      left -= take;
    }
    if (sold <= 0) return { ok: false, reason: 'waste' };
  }

  const taxPct = areaPropertyForLoc(locId).sellTaxPct || 0;
  const tax = taxPct > 0 ? Math.floor(goldGain * taxPct) : 0;
  const net = goldGain - tax;
  s.gold += net;
  if (sold > 0) recordTradeImpact(s, locId, goodId, sold, 'sell');
  return { ok: true, sold, gold: net, tax };
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
  const bridgeBlock = areaBridgeBlockReason(s, s.locationId, toId);
  if (bridgeBlock) return { ok: false, reason: 'capacity_gate', message: bridgeBlock };
  // Slice AT — body-train freight (origin area rate); soft-fail, no debt
  const freight = travelFreightCost(s.locationId, toId) || 0;
  const gold = s.gold | 0;
  if (freight > 0 && gold < freight) {
    return {
      ok: false,
      reason: 'freight',
      message: `Need ${freight}g freight (have ${gold}g)`,
      freight,
    };
  }
  commitStationBuys(s);
  snapshotVisitedPrices(s, s.locationId); // Slice P — leave snapshot
  if (freight > 0) s.gold = gold - freight;
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
  return { ok: true, freight };
}

/**
 * Multi-trip unlock deposit. Moves matching cargo into unlockDeposits[target];
 * unlocks when every cost good has deposited >= qty.
 * @param {import('./state.js').GameState} s
 * @param {{ target: string, requiresUnlocked?: string[], costs: { goodId: string, qty: number }[] }} unlock
 * @returns {{ ok: boolean, reason?: string, unlocked?: boolean }}
 */
export function tryDepositUnlock(s, unlock) {
  if (s.travel) return { ok: false, reason: 'traveling' };
  if (!s.unlocked.includes(s.locationId)) return { ok: false, reason: 'locked_here' };
  if (s.unlocked.includes(unlock.target)) return { ok: false, reason: 'already' };
  for (const id of unlock.requiresUnlocked || []) {
    if (!s.unlocked.includes(id)) return { ok: false, reason: 'prereq' };
  }
  if (!s.unlockDeposits) s.unlockDeposits = {};
  const target = unlock.target;
  if (!s.unlockDeposits[target]) s.unlockDeposits[target] = {};
  const dep = s.unlockDeposits[target];
  let depositedAny = false;
  if (!Array.isArray(s.cargoStacks)) s.cargoStacks = [];
  for (const c of unlock.costs) {
    const deposited = dep[c.goodId] || 0;
    const needLeft = c.qty - deposited;
    if (needLeft <= 0) continue;
    const have = stacksQtyOf(s.cargoStacks, c.goodId);
    const take = Math.min(have, needLeft);
    if (take <= 0) continue;
    // FIFO by stack order (document: unlock deposits consume stacks in array order)
    const { taken } = removeFromStacksFifo(s.cargoStacks, c.goodId, take);
    if (taken <= 0) continue;
    dep[c.goodId] = deposited + taken;
    depositedAny = true;
  }
  if (!depositedAny) return { ok: false, reason: 'nothing' };
  const allMet = unlock.costs.every((c) => (dep[c.goodId] || 0) >= c.qty);
  if (allMet) {
    s.unlocked.push(unlock.target);
    delete s.unlockDeposits[target];
    let universalCourier = false;
    // Slice AD: unlock universal courier routes on Scrap Gate unlock
    if (unlock.target === UNIVERSAL_COURIER_UNLOCK_LOC && !s.universalCourierUnlocked) {
      s.universalCourierUnlocked = true;
      universalCourier = true;
    }
    // Slice BE: Fog Well Scrap once on Fog Well unlock (idempotent)
    if (unlock.target === 'loc_a02z01l002_fog_well') {
      if (!s.personal || typeof s.personal !== 'object') s.personal = {};
      if (!(s.personal[KEY_FOG_WELL_SCRAP] > 0)) {
        s.personal[KEY_FOG_WELL_SCRAP] = 1;
      }
    }
    // Slice BF: Mist Spur Scrap once on Mist Spur unlock (idempotent)
    if (unlock.target === 'loc_a02z01l001_mist_spur') {
      if (!s.personal || typeof s.personal !== 'object') s.personal = {};
      if (!(s.personal[KEY_MIST_SPUR_SCRAP] > 0)) {
        s.personal[KEY_MIST_SPUR_SCRAP] = 1;
      }
    }
    // Slice BM: Exit Ash Scrap once on Exit Ash unlock (idempotent)
    if (unlock.target === 'loc_a01z04l003_exit_ash') {
      if (!s.personal || typeof s.personal !== 'object') s.personal = {};
      if (!(s.personal[KEY_EXIT_ASH_SCRAP] > 0)) {
        s.personal[KEY_EXIT_ASH_SCRAP] = 1;
      }
    }
    // Slice BQ: Cobalt Gate Scrap once on Cobalt Gate unlock (idempotent)
    if (unlock.target === 'loc_a02z03l003_cobalt_gate') {
      if (!s.personal || typeof s.personal !== 'object') s.personal = {};
      if (!(s.personal[KEY_COBALT_GATE_SCRAP] > 0)) {
        s.personal[KEY_COBALT_GATE_SCRAP] = 1;
      }
    }
    // Slice BR: Quiet Pier Scrap once on Quiet Pier unlock (idempotent)
    if (unlock.target === 'loc_a02z02l003_quiet_pier') {
      if (!s.personal || typeof s.personal !== 'object') s.personal = {};
      if (!(s.personal[KEY_QUIET_PIER_SCRAP] > 0)) {
        s.personal[KEY_QUIET_PIER_SCRAP] = 1;
      }
    }
    return { ok: true, unlocked: true, universalCourier };
  }
  return { ok: true, unlocked: false };
}

/** Alias — deposit semantics. */
export function tryUnlock(s, unlock) {
  return tryDepositUnlock(s, unlock);
}

/**
 * Stub cargo capacity upgrade (+20% of base per level, max 5). Cost 500×(level+1)G.
 * @param {import('./state.js').GameState} s
 */
export function tryUpgradeCapacity(s) {
  // Slice AH — allowed mid-travel; capacity takes effect immediately
  const level = Math.max(0, Math.min(CAPACITY_MAX_LEVEL, s.capacityLevel | 0));
  if (level >= CAPACITY_MAX_LEVEL) return { ok: false, reason: 'max' };
  const cost = capacityUpgradeCost(level);
  if (s.gold < cost) return { ok: false, reason: 'gold' };
  s.gold -= cost;
  s.capacityLevel = level + 1;
  s.capacity = effectiveCapacity(s.capacityLevel);
  return { ok: true, level: s.capacityLevel, capacity: s.capacity, cost };
}

/**
 * Slice Z — Preserve rate upgrade (−12% drain per level, max 5). Cost 600×(level+1)G.
 * @param {import('./state.js').GameState} s
 */
export function tryUpgradePreserve(s) {
  // Slice AH — allowed mid-travel; drain factor applies on further travel deplete
  const level = Math.max(0, Math.min(PRESERVE_MAX_LEVEL, s.preserveLevel | 0));
  if (level >= PRESERVE_MAX_LEVEL) return { ok: false, reason: 'max' };
  const cost = preserveUpgradeCost(level);
  if (s.gold < cost) return { ok: false, reason: 'gold' };
  s.gold -= cost;
  s.preserveLevel = level + 1;
  return { ok: true, level: s.preserveLevel, cost };
}

/**
 * Slice AA/AH — Speed upgrade (+20% of base TRAIN_SPEED per level, max 5). Cost 550×(level+1)G.
 * Slice AH: allowed mid-travel; remaining ETA on current leg recalced with new speed (choice A).
 * @param {import('./state.js').GameState} s
 */
export function tryUpgradeSpeed(s) {
  const level = Math.max(0, Math.min(SPEED_MAX_LEVEL, s.speedLevel | 0));
  if (level >= SPEED_MAX_LEVEL) return { ok: false, reason: 'max' };
  const cost = speedUpgradeCost(level);
  if (s.gold < cost) return { ok: false, reason: 'gold' };
  s.gold -= cost;
  s.speedLevel = level + 1;
  const speed = effectiveSpeed(s.speedLevel);
  // Mid-travel (A): rewrite elapsed/duration so traveledDistance stays continuous under new speed
  if (s.travel) {
    const dist = s.travel.distance || 0;
    const oldSpeed = s.travel.speed || 0;
    let traveled = s.travel.traveledDistance;
    if (traveled == null) {
      traveled = oldSpeed > 0 ? Math.min(dist, oldSpeed * ((s.travel.elapsedMs || 0) / 1000)) : 0;
    }
    traveled = Math.max(0, Math.min(dist, traveled));
    s.travel.speed = speed;
    s.travel.traveledDistance = traveled;
    if (speed > 0) {
      s.travel.elapsedMs = (traveled / speed) * 1000;
      s.travel.durationMs = (dist / speed) * 1000;
    }
  }
  return { ok: true, level: s.speedLevel, speed, cost, midTravelApplied: !!s.travel };
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
  const bridgeBlock = areaBridgeBlockReason(s, fromId, toId);
  if (bridgeBlock) return { ok: false, reason: 'capacity_gate', message: bridgeBlock };
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

/**
 * Slice AD/AG — loc eligible for courier route.
 * Before universal: Area1 Zone1 unlocked only (a01z01).
 * After universal: any unlocked loc including Area2.
 * @param {import('./state.js').GameState} s
 * @param {string} id
 */
export function courierLocAllowed(s, id) {
  if (typeof id !== 'string' || !id) return false;
  if (!s.unlocked.includes(id)) return false;
  if (s.universalCourierUnlocked) return true;
  return areaOfLoc(id) === 1 && isZone1Loc(id);
}

/** Hire Zone1 courier once Star Ash is unlocked. Free hire (COURIER_HIRE_COST=0). */
export function tryHireCourier(s) {
  if (s.courier) return { ok: false, reason: 'already' };
  if (!s.unlocked.includes(COURIER_UNLOCK_LOC)) return { ok: false, reason: 'locked' };
  if (COURIER_HIRE_COST > 0 && s.gold < COURIER_HIRE_COST) return { ok: false, reason: 'gold' };
  if (COURIER_HIRE_COST > 0) s.gold -= COURIER_HIRE_COST;

  // Slice AD — seed route from allowed locs (Z1-only until universal)
  const route = LOCATIONS.map((l) => l.id).filter((id) => courierLocAllowed(s, id));
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
    cargoStacks: emptyStacks(),
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
  let rejectedLocked = false;
  for (const id of routeIds) {
    if (typeof id !== 'string') continue;
    if (cleaned.includes(id)) continue;
    if (!courierLocAllowed(s, id)) {
      rejectedLocked = true;
      continue;
    }
    cleaned.push(id);
  }
  if (cleaned.length < 1) return { ok: false, reason: rejectedLocked ? 'locked' : 'empty' };
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
/**
 * Transfer goods either way when co-located docked.
 * Prefer stackId (moves from that stack / merges by unitPrice on dest).
 * Without stackId: FIFO by stack order for goodId.
 * @param {'toCourier'|'toPlayer'} dir
 * @param {string} [stackId]
 */
export function tryTransferGood(s, goodId, dir, qty, stackId) {
  const c = s.courier;
  if (!c) return { ok: false, reason: 'no_courier' };
  if (s.travel || c.travel) return { ok: false, reason: 'traveling' };
  if (c.locationId !== s.locationId) return { ok: false, reason: 'apart' };
  if (!GOODS.some((g) => g.id === goodId)) return { ok: false, reason: 'good' };
  qty = Math.floor(Number(qty));
  if (!(qty > 0)) return { ok: false, reason: 'qty' };
  const w = goodWeightG(goodId);
  if (!(w > 0)) return { ok: false, reason: 'weight' };
  if (!Array.isArray(s.cargoStacks)) s.cargoStacks = [];
  if (!Array.isArray(c.cargoStacks)) c.cargoStacks = [];

  const idGen = () => allocStackId(s);

  function takeFrom(stacks, want) {
    if (stackId) {
      const st = findStack(stacks, stackId);
      if (!st || st.goodId !== goodId) return null;
      return removeFromStack(stacks, stackId, want);
    }
    const { removed, taken } = removeFromStacksFifo(stacks, goodId, want);
    if (taken <= 0) return null;
    // collapse to one chunk only if same unitPrice+condition — otherwise move piece by piece
    if (removed.length === 1) return removed[0];
    return { multi: removed, qty: taken };
  }

  function putChunks(destStacks, chunk) {
    if (chunk.multi) {
      for (const part of chunk.multi) {
        addToStacks(destStacks, {
          goodId: part.goodId,
          unitPrice: part.unitPrice,
          qty: part.qty,
          condition: part.condition,
        }, idGen);
      }
      return;
    }
    addToStacks(destStacks, {
      goodId: chunk.goodId,
      unitPrice: chunk.unitPrice,
      qty: chunk.qty,
      condition: chunk.condition,
    }, idGen);
  }

  if (dir === 'toCourier') {
    const have = stackId
      ? (findStack(s.cargoStacks, stackId)?.qty || 0)
      : stacksQtyOf(s.cargoStacks, goodId);
    if (have < qty) return { ok: false, reason: 'stock' };
    if (courierCargoUsed(c) + w * qty > c.capacity) return { ok: false, reason: 'capacity' };
    const chunk = takeFrom(s.cargoStacks, qty);
    if (!chunk) return { ok: false, reason: 'stock' };
    putChunks(c.cargoStacks, chunk);
  } else if (dir === 'toPlayer') {
    const have = stackId
      ? (findStack(c.cargoStacks, stackId)?.qty || 0)
      : stacksQtyOf(c.cargoStacks, goodId);
    if (have < qty) return { ok: false, reason: 'stock' };
    if (cargoUsed(s) + w * qty > s.capacity) return { ok: false, reason: 'capacity' };
    const chunk = takeFrom(c.cargoStacks, qty);
    if (!chunk) return { ok: false, reason: 'stock' };
    putChunks(s.cargoStacks, chunk);
  } else {
    return { ok: false, reason: 'dir' };
  }
  return { ok: true };
}


/**
 * Slice AB/AE/AG — deposit from a cargo stack into the hub warehouse for current area.
 * @param {'player'|'courier'} who
 * @param {string} [stackId] source stack; omit → FIFO by goodId
 */
export function tryWarehouseDeposit(s, who, goodId, qty, stackId) {
  if (who !== 'player' && who !== 'courier') return { ok: false, reason: 'who' };
  if (!GOODS.some((g) => g.id === goodId)) return { ok: false, reason: 'good' };
  qty = Math.floor(Number(qty));
  if (!(qty > 0)) return { ok: false, reason: 'qty' };
  const w = goodWeightG(goodId);
  if (!(w > 0)) return { ok: false, reason: 'weight' };

  const hubKey = warehouseKeyAtPlayer(s);
  if (!hubKey) return { ok: false, reason: 'not_at_hub' };

  if (who === 'player') {
    if (!playerAtWarehouse(s)) return { ok: false, reason: 'not_at_hub' };
  } else {
    if (!courierAtWarehouse(s)) return { ok: false, reason: 'not_at_hub' };
    if (!s.courier) return { ok: false, reason: 'no_courier' };
  }

  const bagStacks = who === 'player' ? (s.cargoStacks || (s.cargoStacks = [])) : (s.courier.cargoStacks || (s.courier.cargoStacks = []));
  const have = stackId
    ? (findStack(bagStacks, stackId)?.qty || 0)
    : stacksQtyOf(bagStacks, goodId);
  if (have < qty) return { ok: false, reason: 'stock' };

  const wh = ensureWarehouse(s, hubKey);
  const used = warehouseUsed(s, hubKey);
  if (used + w * qty > WAREHOUSE_CAP) return { ok: false, reason: 'warehouse_cap' };

  const idGen = () => allocStackId(s);
  /** @type {{ goodId: string, unitPrice: number, qty: number, condition: number }[]} */
  let parts = [];
  if (stackId) {
    const removed = removeFromStack(bagStacks, stackId, qty);
    if (!removed) return { ok: false, reason: 'stock' };
    if (removed.condition <= 0 && depleteRateForGood(goodId) > 0) {
      // put back? treat as waste refuse — restore
      addToStacks(bagStacks, removed, idGen);
      return { ok: false, reason: 'waste' };
    }
    parts = [removed];
  } else {
    const { removed, taken } = removeFromStacksFifo(bagStacks, goodId, qty);
    if (taken < qty) {
      // restore (shouldn't happen after have check)
      for (const part of removed) addToStacks(bagStacks, part, idGen);
      return { ok: false, reason: 'stock' };
    }
    parts = removed;
  }
  for (const part of parts) {
    addToStacks(wh.stacks, {
      goodId: part.goodId,
      unitPrice: part.unitPrice,
      qty: part.qty,
      condition: part.condition,
    }, idGen);
  }
  return { ok: true };
}

/**
 * Slice AB/AE/AG — withdraw a warehouse stack into player or courier cargo.
 * @param {'player'|'courier'} who
 * @param {string} [stackId] warehouse stack; omit → FIFO by goodId
 */
export function tryWarehouseWithdraw(s, who, goodId, qty, stackId) {
  if (who !== 'player' && who !== 'courier') return { ok: false, reason: 'who' };
  if (!GOODS.some((g) => g.id === goodId)) return { ok: false, reason: 'good' };
  qty = Math.floor(Number(qty));
  if (!(qty > 0)) return { ok: false, reason: 'qty' };
  const w = goodWeightG(goodId);
  if (!(w > 0)) return { ok: false, reason: 'weight' };

  const hubKey = warehouseKeyAtPlayer(s);
  if (!hubKey) return { ok: false, reason: 'not_at_hub' };

  if (who === 'player') {
    if (!playerAtWarehouse(s)) return { ok: false, reason: 'not_at_hub' };
  } else {
    if (!courierAtWarehouse(s)) return { ok: false, reason: 'not_at_hub' };
    if (!s.courier) return { ok: false, reason: 'no_courier' };
  }

  const wh = ensureWarehouse(s, hubKey);
  const have = stackId
    ? (findStack(wh.stacks, stackId)?.qty || 0)
    : stacksQtyOf(wh.stacks, goodId);
  if (have < qty) return { ok: false, reason: 'stock' };

  const bagStacks = who === 'player' ? (s.cargoStacks || (s.cargoStacks = [])) : (s.courier.cargoStacks || (s.courier.cargoStacks = []));
  const used = who === 'player' ? cargoUsed(s) : courierCargoUsed(s.courier);
  const cap = who === 'player' ? s.capacity : s.courier.capacity;
  if (used + w * qty > cap) return { ok: false, reason: 'capacity' };

  const idGen = () => allocStackId(s);
  /** @type {{ goodId: string, unitPrice: number, qty: number, condition: number }[]} */
  let parts = [];
  if (stackId) {
    const removed = removeFromStack(wh.stacks, stackId, qty);
    if (!removed) return { ok: false, reason: 'stock' };
    if (removed.condition <= 0 && depleteRateForGood(goodId) > 0) {
      addToStacks(wh.stacks, removed, idGen);
      return { ok: false, reason: 'waste' };
    }
    parts = [removed];
  } else {
    const { removed, taken } = removeFromStacksFifo(wh.stacks, goodId, qty);
    if (taken < qty) {
      for (const part of removed) addToStacks(wh.stacks, part, idGen);
      return { ok: false, reason: 'stock' };
    }
    parts = removed;
  }
  for (const part of parts) {
    addToStacks(bagStacks, {
      goodId: part.goodId,
      unitPrice: part.unitPrice,
      qty: part.qty,
      condition: part.condition,
    }, idGen);
  }
  return { ok: true };
}
