/** @typedef {{ id: string, name: string, x: number, y: number }} LocDef */
/** @typedef {{ a: string, b: string, travelMs: number }} EdgeDef */

/** Naming v2: loc_aAAzZZlLLL_slug — name is display label. */
/** @type {LocDef[]} */
export const LOCATIONS = [
  { id: 'loc_a01z01l001_broken_lamp', name: 'Broken Lamp', x: 120, y: 220 },
  { id: 'loc_a01z01l002_drywind_depot', name: 'Drywind Depot', x: 340, y: 160 },
  { id: 'loc_a01z01l003_star_ash', name: 'Star Ash', x: 560, y: 240 },
];

/** @type {EdgeDef[]} */
export const EDGES = [
  { a: 'loc_a01z01l001_broken_lamp', b: 'loc_a01z01l002_drywind_depot', travelMs: 8000 },
  { a: 'loc_a01z01l002_drywind_depot', b: 'loc_a01z01l003_star_ash', travelMs: 10000 },
];

export const START_LOC = 'loc_a01z01l001_broken_lamp';
export const INITIALLY_UNLOCKED = [
  'loc_a01z01l001_broken_lamp',
  'loc_a01z01l002_drywind_depot',
];

/** @returns {number|null} */
export function travelMsBetween(fromId, toId) {
  for (const e of EDGES) {
    if ((e.a === fromId && e.b === toId) || (e.b === fromId && e.a === toId)) {
      return e.travelMs;
    }
  }
  return null;
}

/** @returns {string[]} */
export function neighborsOf(locId) {
  const out = [];
  for (const e of EDGES) {
    if (e.a === locId) out.push(e.b);
    if (e.b === locId) out.push(e.a);
  }
  return out;
}

/** @param {string} id */
export function locName(id) {
  return LOCATIONS.find((l) => l.id === id)?.name || id;
}
