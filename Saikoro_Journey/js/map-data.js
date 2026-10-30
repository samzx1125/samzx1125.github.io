/** @typedef {{ id: string, name: string, x: number, y: number }} LocDef */
/** @typedef {{ a: string, b: string, distance: number }} EdgeDef */

/** Naming v2: loc_aAAzZZlLLL_slug — name is display label. */
/** @type {LocDef[]} */
export const LOCATIONS = [
  { id: 'loc_a01z01l001_broken_lamp', name: 'Broken Lamp', x: 120, y: 220 },
  { id: 'loc_a01z01l002_drywind_depot', name: 'Drywind Depot', x: 340, y: 160 },
  { id: 'loc_a01z01l003_star_ash', name: 'Star Ash', x: 560, y: 240 },
];

/** Distance units along the rail (variables — ETA = distance / TRAIN_SPEED). */
/** @type {EdgeDef[]} */
export const EDGES = [
  { a: 'loc_a01z01l001_broken_lamp', b: 'loc_a01z01l002_drywind_depot', distance: 100 },
  { a: 'loc_a01z01l002_drywind_depot', b: 'loc_a01z01l003_star_ash', distance: 125 },
];

/** Initial train speed (distance units per second). */
export const TRAIN_SPEED = 10;

export const START_LOC = 'loc_a01z01l001_broken_lamp';
export const INITIALLY_UNLOCKED = [
  'loc_a01z01l001_broken_lamp',
  'loc_a01z01l002_drywind_depot',
];

/** @returns {number|null} */
export function distanceBetween(fromId, toId) {
  for (const e of EDGES) {
    if ((e.a === fromId && e.b === toId) || (e.b === fromId && e.a === toId)) {
      return e.distance;
    }
  }
  return null;
}

/** ETA ms from distance / speed. @returns {number|null} */
export function travelMsBetween(fromId, toId, speed = TRAIN_SPEED) {
  const d = distanceBetween(fromId, toId);
  if (d == null || !(speed > 0)) return null;
  return (d / speed) * 1000;
}

/**
 * Dynamic ETA units: `Xs` / `Xm Ys` / `Xh Ym Zs`.
 * @param {number} ms
 */
export function formatEta(ms) {
  let s = Math.max(0, Math.round(Number(ms) / 1000));
  const h = Math.floor(s / 3600);
  s %= 3600;
  const m = Math.floor(s / 60);
  s %= 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
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

/**
 * Shortest loc-id path along EDGES (BFS). Both ends of each hop should be unlocked by caller if needed.
 * @param {string} fromId
 * @param {string} toId
 * @param {string[] | null} [allowedIds] if set, only traverse these locs
 * @returns {string[] | null} path including from and to, or null
 */
export function shortestPath(fromId, toId, allowedIds = null) {
  if (fromId === toId) return [fromId];
  const allow = allowedIds ? new Set(allowedIds) : null;
  if (allow && (!allow.has(fromId) || !allow.has(toId))) return null;
  /** @type {Record<string, string | null>} */
  const prev = { [fromId]: null };
  const q = [fromId];
  while (q.length) {
    const cur = q.shift();
    for (const n of neighborsOf(cur)) {
      if (allow && !allow.has(n)) continue;
      if (n in prev) continue;
      prev[n] = cur;
      if (n === toId) {
        const path = [toId];
        let p = cur;
        while (p != null) {
          path.push(p);
          p = prev[p];
        }
        path.reverse();
        return path;
      }
      q.push(n);
    }
  }
  return null;
}
