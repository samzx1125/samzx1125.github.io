import { LOCATIONS, INITIALLY_UNLOCKED, START_LOC } from './map-data.js?v=z1-20261028o';
import { GOODS, BASE_PRICES, START_GOLD, CAPACITY } from './economy-data.js?v=z1-20261028o';

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
  };
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
