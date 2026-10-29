import { cargoUsed, commitStationBuys } from './state.js?v=z1-20261028v';
import {
  goodWeightG,
  STOP_REROUTE_UNLOCKED,
  BASE_PRICES,
  GOODS,
  PRICE_DRIFT_INTERVAL_MS,
  PRICE_DRIFT_PCT_MAX,
  PRICE_DRIFT_BAND,
} from './economy-data.js?v=z1-20261028v';
import { LOCATIONS } from './map-data.js?v=z1-20261028v';

/**
 * @param {import('./state.js').GameState} s
 * @param {number} nowMs
 */
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
      const delta = base * ((Math.random() * 2 - 1) * PRICE_DRIFT_PCT_MAX);
      let next = current + delta;
      const lo = Math.max(1, base * (1 - PRICE_DRIFT_BAND));
      const hi = base * (1 + PRICE_DRIFT_BAND);
      if (next < lo) next = lo;
      if (next > hi) next = hi;
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
    s.travel.traveledDistance = Math.min(dist, speed * (s.travel.elapsedMs / 1000));
    if (s.travel.elapsedMs >= s.travel.durationMs) {
      s.locationId = s.travel.to;
      s.selectedLocId = s.travel.to;
      s.travel = null;
    }
  }
  // Slice L — price slow-drift every ~5s
  if (!s.lastPriceDriftMs) s.lastPriceDriftMs = nowMs;
  while (nowMs - s.lastPriceDriftMs >= PRICE_DRIFT_INTERVAL_MS) {
    s.lastPriceDriftMs += PRICE_DRIFT_INTERVAL_MS;
    driftPricesOnce(s);
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
  s.cargo[goodId] = (s.cargo[goodId] || 0) + qty;
  // Slice G: save buy MP into this station visit (avg committed on leave)
  if (!s.stationBuys) s.stationBuys = {};
  const sb = s.stationBuys[goodId] || { sum: 0, qty: 0 };
  sb.sum += price * qty;
  sb.qty += qty;
  s.stationBuys[goodId] = sb;
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
  s.cargo[goodId] -= qty;
  s.gold += price * qty;
  // Keep buyMp in sync with remaining cargo (FIFO-ish qty shrink)
  if (s.buyMp?.[goodId]) {
    s.buyMp[goodId].qty = Math.max(0, s.buyMp[goodId].qty - qty);
    if (s.buyMp[goodId].qty <= 0) delete s.buyMp[goodId];
  }
  if (s.stationBuys?.[goodId]) {
    // shrink pending proportional if sold before leave — prefer cutting pending last;
    // simple: cut committed first above; if cargo still tracks, trim pending to not exceed cargo
    const cargoLeft = s.cargo[goodId] || 0;
    const committedQty = s.buyMp?.[goodId]?.qty || 0;
    const maxPend = Math.max(0, cargoLeft - committedQty);
    if (s.stationBuys[goodId].qty > maxPend) {
      const keep = maxPend;
      if (keep <= 0) delete s.stationBuys[goodId];
      else {
        const unit = s.stationBuys[goodId].sum / s.stationBuys[goodId].qty;
        s.stationBuys[goodId] = { qty: keep, sum: unit * keep };
      }
    }
  }
  return { ok: true };
}

/**
 * @param {import('./state.js').GameState} s
 * @param {string} toId
 * @param {number} durationMs
 */
/**
 * @param {number} durationMs
 * @param {{ distance?: number, speed?: number }} [meta]
 */
export function tryTravel(s, toId, durationMs, meta = {}) {
  if (s.travel) return { ok: false, reason: 'traveling' };
  if (!s.unlocked.includes(toId)) return { ok: false, reason: 'locked' };
  if (toId === s.locationId) return { ok: false, reason: 'same' };
  if (durationMs == null || durationMs <= 0) return { ok: false, reason: 'no_edge' };
  commitStationBuys(s);
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
