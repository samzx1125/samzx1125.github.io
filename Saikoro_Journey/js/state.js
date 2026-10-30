import { LOCATIONS, INITIALLY_UNLOCKED, START_LOC } from './map-data.js?v=z1-20261028ab';
import { GOODS, BASE_PRICES, START_GOLD, CAPACITY, goodWeightG, COURIER_CAPACITY } from './economy-data.js?v=z1-20261028ab';

/**
 * @typedef {{
 *   gold: number,
 *   capacity: number, // grams
 *   cargo: Record<string, number>,
 *   condition: Record<string, number>, // 0–100% for goods that deplete; absent = 100
 *   quest: null | { from: string, to: string, goodId: string, qty: number, rewardGold: number, condition: number },
 *   locationId: string,
 *   unlocked: string[],
 *   travel: null | { from: string, to: string, elapsedMs: number, durationMs: number, distance: number, speed: number, traveledDistance: number },
 *   prices: Record<string, Record<string, number>>,
 *   visitedPrices: Record<string, Record<string, number>>, // Slice P — last-seen MP per station
 *   courier: null | CourierState,
 *   selectedLocId: string | null,
 *   nowMs: number,
 *   buyMp: Record<string, { avg: number, qty: number }>,
 *   stationBuys: Record<string, { sum: number, qty: number }>,
 *   lastPriceDriftMs: number,
 *   tradeImpact: Record<string, { buys: { t: number, qty: number }[], sells: { t: number, qty: number }[] }>,
 * }} GameState
 *
 * @typedef {{
 *   locationId: string,
 *   gold: number,
 *   capacity: number,
 *   cargo: Record<string, number>,
 *   condition: Record<string, number>,
 *   route: string[],
 *   routeIndex: number,
 *   trade: Record<string, Record<string, { buy: boolean, sell: boolean }>>,
 *   travel: null | { from: string, to: string, elapsedMs: number, durationMs: number, distance: number, speed: number, traveledDistance: number, finalDest?: string },
 *   paused: boolean,
 * }} CourierState
 */

/** @returns {GameState} */
export function createInitialState() {
  /** @type {Record<string, Record<string, number>>} */
  const prices = {};
  for (const loc of LOCATIONS) {
    prices[loc.id] = {};
    const base = BASE_PRICES[loc.id] || {};
    for (const g of GOODS) {
      if (base[g.id] != null) prices[loc.id][g.id] = base[g.id];
    }
  }
  /** @type {Record<string, number>} */
  const cargo = {};
  for (const g of GOODS) cargo[g.id] = 0;

  /** @type {GameState} */
  const s = {
    gold: START_GOLD,
    capacity: CAPACITY,
    cargo,
    condition: {},
    quest: null,
    locationId: START_LOC,
    unlocked: [...INITIALLY_UNLOCKED],
    travel: null,
    prices,
    visitedPrices: {},
    courier: null,
    selectedLocId: START_LOC,
    nowMs: performance.now(),
    buyMp: {},
    stationBuys: {},
    lastPriceDriftMs: 0,
    tradeImpact: {},
  };
  // start station counts as visited
  const startRow = prices[START_LOC] || {};
  const startSnap = {};
  for (const g of GOODS) {
    const p = startRow[g.id];
    if (p != null && Number.isFinite(p)) startSnap[g.id] = Math.round(p);
  }
  s.visitedPrices[START_LOC] = startSnap;
  return s;
}

/** Pending + committed buy MP average for a good (null if none). */
export function effectiveBuyAvg(s, goodId) {
  const committed = s.buyMp?.[goodId];
  const pending = s.stationBuys?.[goodId];
  const cQty = committed?.qty || 0;
  const pQty = pending?.qty || 0;
  if (cQty + pQty <= 0) return null;
  const cSum = (committed?.avg || 0) * cQty;
  const pSum = pending?.sum || 0;
  return (cSum + pSum) / (cQty + pQty);
}

/** Fold stationBuys into buyMp (call when leaving a station). */
export function commitStationBuys(s) {
  if (!s.stationBuys) s.stationBuys = {};
  if (!s.buyMp) s.buyMp = {};
  for (const goodId of Object.keys(s.stationBuys)) {
    const pend = s.stationBuys[goodId];
    if (!pend || !pend.qty) continue;
    const cur = s.buyMp[goodId] || { avg: 0, qty: 0 };
    const newQty = cur.qty + pend.qty;
    const newAvg = newQty > 0 ? (cur.avg * cur.qty + pend.sum) / newQty : 0;
    s.buyMp[goodId] = { avg: newAvg, qty: newQty };
  }
  s.stationBuys = {};
}


/** Total cargo weight in grams. @param {GameState} s */
export function cargoUsed(s) {
  let grams = 0;
  for (const g of GOODS) {
    const n = s.cargo[g.id] || 0;
    if (n) grams += n * (g.weightG || 0);
  }
  if (s.quest && s.quest.qty > 0) {
    grams += s.quest.qty * (goodWeightG(s.quest.goodId) || 0);
  }
  return grams;
}

/** Courier cargo weight (no quest lot). @param {CourierState} c */
export function courierCargoUsed(c) {
  if (!c) return 0;
  let grams = 0;
  for (const g of GOODS) {
    const n = c.cargo[g.id] || 0;
    if (n) grams += n * (g.weightG || 0);
  }
  return grams;
}

/** Empty cargo map for a new courier. */
export function emptyCargoMap() {
  /** @type {Record<string, number>} */
  const cargo = {};
  for (const g of GOODS) cargo[g.id] = 0;
  return cargo;
}

/** @param {GameState} s */
export function isTraveling(s) {
  return s.travel != null;
}

/** Player + courier both docked at same station. */
export function courierCoLocated(s) {
  const c = s.courier;
  if (!c) return false;
  if (s.travel || c.travel) return false;
  return c.locationId === s.locationId;
}

/** Condition % for a good (100 if unset / non-depleting stock). */
export function goodCondition(s, goodId) {
  const n = s.cargo[goodId] || 0;
  if (n <= 0) return 0;
  const c = s.condition?.[goodId];
  return c == null ? 100 : Math.max(0, Math.min(100, c));
}

/** Courier condition % for a good. */
export function courierGoodCondition(c, goodId) {
  if (!c) return 0;
  const n = c.cargo[goodId] || 0;
  if (n <= 0) return 0;
  const v = c.condition?.[goodId];
  return v == null ? 100 : Math.max(0, Math.min(100, v));
}

/** Copy live MP for loc into visitedPrices (Slice P). */
export function snapshotVisitedPrices(s, locId) {
  if (!locId || !s.prices?.[locId]) return;
  if (!s.visitedPrices) s.visitedPrices = {};
  const row = s.prices[locId];
  const snap = {};
  for (const g of GOODS) {
    const p = row[g.id];
    if (p != null && Number.isFinite(p)) snap[g.id] = Math.round(p);
  }
  s.visitedPrices[locId] = snap;
}

/** Default courier capacity constant re-export helper. */
export function defaultCourierCapacity() {
  return COURIER_CAPACITY;
}
