import { LOCATIONS, INITIALLY_UNLOCKED, START_LOC } from './map-data.js?v=z1-20261028p';
import { GOODS, BASE_PRICES, START_GOLD, CAPACITY } from './economy-data.js?v=z1-20261028p';

/**
 * @typedef {{
 *   gold: number,
 *   capacity: number, // grams
 *   cargo: Record<string, number>,
 *   locationId: string,
 *   unlocked: string[],
 *   travel: null | { from: string, to: string, elapsedMs: number, durationMs: number, distance: number, speed: number, traveledDistance: number },
 *   prices: Record<string, Record<string, number>>,
 *   selectedLocId: string | null,
 *   nowMs: number,
 *   buyMp: Record<string, { avg: number, qty: number }>,
 *   stationBuys: Record<string, { sum: number, qty: number }>,
 * }} GameState
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

  return {
    gold: START_GOLD,
    capacity: CAPACITY,
    cargo,
    locationId: START_LOC,
    unlocked: [...INITIALLY_UNLOCKED],
    travel: null,
    prices,
    selectedLocId: START_LOC,
    nowMs: performance.now(),
    buyMp: {},
    stationBuys: {},
  };
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
  return grams;
}

/** @param {GameState} s */
export function isTraveling(s) {
  return s.travel != null;
}
