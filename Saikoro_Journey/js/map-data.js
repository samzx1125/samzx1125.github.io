/** @typedef {{ id: string, name: string, x: number, y: number }} LocDef */
/** @typedef {{ a: string, b: string, distance: number }} EdgeDef */

/** Naming v2: loc_aAAzZZlLLL_slug — name is display label. */
/** @type {LocDef[]} */
export const LOCATIONS = [
  { id: 'loc_a01z01l001_broken_lamp', name: 'Broken Lamp', x: 120, y: 220 },
  { id: 'loc_a01z01l002_drywind_depot', name: 'Drywind Depot', x: 340, y: 160 },
  { id: 'loc_a01z01l003_star_ash', name: 'Star Ash', x: 560, y: 240 },
  // Slice T — Zone 2 (right of Star Ash)
  { id: 'loc_a01z02l001_deep_dune', name: 'Deep Dune', x: 740, y: 200 },
  { id: 'loc_a01z02l002_salt_glass', name: 'Salt Glass', x: 900, y: 280 },
  { id: 'loc_a01z02l003_night_well', name: 'Night Well', x: 1040, y: 180 },
  // Slice W — Zone 3 (舊油路／遺址, right of Night Well)
  { id: 'loc_a01z03l001_rust_spur', name: 'Rust Spur', x: 1180, y: 220 },
  { id: 'loc_a01z03l002_ash_pump', name: 'Ash Pump', x: 1340, y: 160 },
  { id: 'loc_a01z03l003_scrap_gate', name: 'Scrap Gate', x: 1480, y: 260 },
  // Slice X — Zone 4 (沙漠核心／關口, right of Scrap Gate)
  { id: 'loc_a01z04l001_dune_crown', name: 'Dune Crown', x: 1640, y: 200 },
  { id: 'loc_a01z04l002_star_gate', name: 'Star Gate', x: 1800, y: 280 },
  { id: 'loc_a01z04l003_exit_ash', name: 'Exit Ash', x: 1960, y: 180 },
  // Slice AG — Area 2 stub (right of Exit Ash); mist placeholders, English short names
  { id: 'loc_a02z01l001_mist_spur', name: 'Mist Spur', x: 2140, y: 200 },
  { id: 'loc_a02z01l002_fog_well', name: 'Fog Well', x: 2280, y: 280 },
  { id: 'loc_a02z01l003_pale_lamp', name: 'Pale Lamp', x: 2420, y: 160 },
  { id: 'loc_a02z02l001_reed_bank', name: 'Reed Bank', x: 2580, y: 220 },
  { id: 'loc_a02z02l002_glass_fen', name: 'Glass Fen', x: 2720, y: 150 },
  { id: 'loc_a02z02l003_quiet_pier', name: 'Quiet Pier', x: 2860, y: 260 },
  { id: 'loc_a02z03l001_iron_marsh', name: 'Iron Marsh', x: 3020, y: 200 },
  { id: 'loc_a02z03l002_drift_yard', name: 'Drift Yard', x: 3160, y: 280 },
  { id: 'loc_a02z03l003_cobalt_gate', name: 'Cobalt Gate', x: 3300, y: 170 },
  { id: 'loc_a02z04l001_high_loom', name: 'High Loom', x: 3460, y: 220 },
  { id: 'loc_a02z04l002_silk_cut', name: 'Silk Cut', x: 3600, y: 150 },
  { id: 'loc_a02z04l003_far_beacon', name: 'Far Beacon', x: 3740, y: 250 },
];

/** Distance units along the rail (variables — ETA = distance / TRAIN_SPEED). */
/** @type {EdgeDef[]} */
export const EDGES = [
  { a: 'loc_a01z01l001_broken_lamp', b: 'loc_a01z01l002_drywind_depot', distance: 100 },
  { a: 'loc_a01z01l002_drywind_depot', b: 'loc_a01z01l003_star_ash', distance: 125 },
  // Slice T — Z1↔Z2 bridge + Z2 chain + optional triangle
  { a: 'loc_a01z01l003_star_ash', b: 'loc_a01z02l001_deep_dune', distance: 140 },
  { a: 'loc_a01z02l001_deep_dune', b: 'loc_a01z02l002_salt_glass', distance: 130 },
  { a: 'loc_a01z02l002_salt_glass', b: 'loc_a01z02l003_night_well', distance: 150 },
  { a: 'loc_a01z02l001_deep_dune', b: 'loc_a01z02l003_night_well', distance: 160 },
  // Slice W — Z2↔Z3 bridge + Z3 chain + triangle
  { a: 'loc_a01z02l003_night_well', b: 'loc_a01z03l001_rust_spur', distance: 170 },
  { a: 'loc_a01z03l001_rust_spur', b: 'loc_a01z03l002_ash_pump', distance: 160 },
  { a: 'loc_a01z03l002_ash_pump', b: 'loc_a01z03l003_scrap_gate', distance: 180 },
  { a: 'loc_a01z03l001_rust_spur', b: 'loc_a01z03l003_scrap_gate', distance: 190 },
  // Slice X — Z3↔Z4 bridge + Z4 chain + triangle
  { a: 'loc_a01z03l003_scrap_gate', b: 'loc_a01z04l001_dune_crown', distance: 200 },
  { a: 'loc_a01z04l001_dune_crown', b: 'loc_a01z04l002_star_gate', distance: 180 },
  { a: 'loc_a01z04l002_star_gate', b: 'loc_a01z04l003_exit_ash', distance: 200 },
  { a: 'loc_a01z04l001_dune_crown', b: 'loc_a01z04l003_exit_ash', distance: 210 },
  // Slice AG — Exit Ash ↔ Mist Spur + A2 zone chains + triangles
  { a: 'loc_a01z04l003_exit_ash', b: 'loc_a02z01l001_mist_spur', distance: 180 },
  { a: 'loc_a02z01l001_mist_spur', b: 'loc_a02z01l002_fog_well', distance: 150 },
  { a: 'loc_a02z01l002_fog_well', b: 'loc_a02z01l003_pale_lamp', distance: 160 },
  { a: 'loc_a02z01l001_mist_spur', b: 'loc_a02z01l003_pale_lamp', distance: 170 },
  { a: 'loc_a02z01l003_pale_lamp', b: 'loc_a02z02l001_reed_bank', distance: 170 },
  { a: 'loc_a02z02l001_reed_bank', b: 'loc_a02z02l002_glass_fen', distance: 150 },
  { a: 'loc_a02z02l002_glass_fen', b: 'loc_a02z02l003_quiet_pier', distance: 160 },
  { a: 'loc_a02z02l001_reed_bank', b: 'loc_a02z02l003_quiet_pier', distance: 175 },
  { a: 'loc_a02z02l003_quiet_pier', b: 'loc_a02z03l001_iron_marsh', distance: 180 },
  { a: 'loc_a02z03l001_iron_marsh', b: 'loc_a02z03l002_drift_yard', distance: 155 },
  { a: 'loc_a02z03l002_drift_yard', b: 'loc_a02z03l003_cobalt_gate', distance: 165 },
  { a: 'loc_a02z03l001_iron_marsh', b: 'loc_a02z03l003_cobalt_gate', distance: 180 },
  { a: 'loc_a02z03l003_cobalt_gate', b: 'loc_a02z04l001_high_loom', distance: 185 },
  { a: 'loc_a02z04l001_high_loom', b: 'loc_a02z04l002_silk_cut', distance: 160 },
  { a: 'loc_a02z04l002_silk_cut', b: 'loc_a02z04l003_far_beacon', distance: 170 },
  { a: 'loc_a02z04l001_high_loom', b: 'loc_a02z04l003_far_beacon', distance: 190 },
];

/** Initial train speed (distance units per second). */
export const TRAIN_SPEED = 10;

export const START_LOC = 'loc_a01z01l001_broken_lamp';
export const INITIALLY_UNLOCKED = [
  'loc_a01z01l001_broken_lamp',
  'loc_a01z01l002_drywind_depot',
];

/** Area number from loc id (loc_a01… → 1, loc_a02… → 2). @returns {number|null} */
export function areaOfLoc(id) {
  if (typeof id !== 'string') return null;
  const m = /^loc_a(\d+)/.exec(id);
  return m ? Number(m[1]) : null;
}

/** Zone number from loc id (z01 → 1 … z04 → 4). @returns {number|null} */
export function zoneOfLoc(id) {
  if (typeof id !== 'string') return null;
  const m = /loc_a\d+z(\d+)/.exec(id);
  return m ? Number(m[1]) : null;
}

/** Zone1-only helper (courier routing). Matches loc_a##z01… */
export function isZone1Loc(id) {
  return typeof id === 'string' && /loc_a\d+z01/.test(id);
}

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
