/** @typedef {{ id: string, name: string, x: number, y: number }} LocDef */
/** @typedef {{ a: string, b: string, travelMs: number }} EdgeDef */

/** Display name = id (obvious placeholders). */
/** @type {LocDef[]} */
export const LOCATIONS = [
  { id: 'area_1_zone_1_location_1', name: 'area_1_zone_1_location_1', x: 120, y: 220 },
  { id: 'area_1_zone_1_location_2', name: 'area_1_zone_1_location_2', x: 340, y: 160 },
  { id: 'area_1_zone_1_location_3', name: 'area_1_zone_1_location_3', x: 560, y: 240 },
];

/** @type {EdgeDef[]} */
export const EDGES = [
  { a: 'area_1_zone_1_location_1', b: 'area_1_zone_1_location_2', travelMs: 8000 },
  { a: 'area_1_zone_1_location_2', b: 'area_1_zone_1_location_3', travelMs: 10000 },
];

export const START_LOC = 'area_1_zone_1_location_1';
export const INITIALLY_UNLOCKED = [
  'area_1_zone_1_location_1',
  'area_1_zone_1_location_2',
  'area_1_zone_1_location_3', // UI slice: all unlocked for movement testing
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
