import { LOCATIONS, INITIALLY_UNLOCKED, START_LOC } from './map-data.js';
import { GOODS, BASE_PRICES, START_GOLD, CAPACITY } from './economy-data.js';

/**
 * @typedef {{
 *   gold: number,
 *   capacity: number,
 *   cargo: Record<string, number>,
 *   locationId: string,
 *   unlocked: string[],
 *   travel: null | { from: string, to: string, elapsedMs: number, durationMs: number },
 *   prices: Record<string, Record<string, number>>,
 *   impact: Record<string, Record<string, { buyQty: number, sellQty: number, buyWindowStart: number, sellWindowStart: number, buyPush: number, sellPush: number }>>,
 *   selectedLocId: string | null,
 *   nowMs: number,
 *   lastDriftMs: number,
 * }} GameState
 */

/** @returns {GameState} */
export function createInitialState() {
  /** @type {Record<string, Record<string, number>>} */
  const prices = {};
  /** @type {Record<string, Record<string, any>>} */
  const impact = {};

  for (const loc of LOCATIONS) {
    prices[loc.id] = {};
    impact[loc.id] = {};
    const base = BASE_PRICES[loc.id] || {};
    for (const g of GOODS) {
      if (base[g.id] != null) {
        prices[loc.id][g.id] = base[g.id];
        impact[loc.id][g.id] = {
          buyQty: 0,
          sellQty: 0,
          buyWindowStart: 0,
          sellWindowStart: 0,
          buyPush: 0,
          sellPush: 0,
        };
      }
    }
  }

  /** @type {Record<string, number>} */
  const cargo = {};
  for (const g of GOODS) cargo[g.id] = 0;

  const now = performance.now();
  return {
    gold: START_GOLD,
    capacity: CAPACITY,
    cargo,
    locationId: START_LOC,
    unlocked: [...INITIALLY_UNLOCKED],
    travel: null,
    prices,
    impact,
    selectedLocId: START_LOC,
    nowMs: now,
    lastDriftMs: now,
  };
}

/** @param {GameState} s */
export function cargoUsed(s) {
  let n = 0;
  for (const k of Object.keys(s.cargo)) n += s.cargo[k] || 0;
  return n;
}

/** @param {GameState} s */
export function isTraveling(s) {
  return s.travel != null;
}

/** @param {GameState} s @param {string} locId */
export function isUnlocked(s, locId) {
  return s.unlocked.includes(locId);
}
