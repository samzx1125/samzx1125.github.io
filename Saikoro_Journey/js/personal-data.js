/** Slice U — personal / key-item inventory (not trade goods; no cargo weight). */

/**
 * @typedef {{ id: string, name: string, kind: 'key' | 'item', desc: string }} PersonalDef
 */

/** Naming v2: key_a01k001_<slug> / item_a01i001_<slug> */
/** @type {PersonalDef[]} */
export const PERSONAL_DEFS = [
  {
    id: 'key_a01k001_mirror_residue',
    name: 'Mirror Residue',
    kind: 'key',
    desc: 'A flake of glass that won’t forget the wrong face.',
  },
];

export const KEY_MIRROR_RESIDUE = 'key_a01k001_mirror_residue';

/** @param {string} id */
export function personalName(id) {
  return PERSONAL_DEFS.find((d) => d.id === id)?.name || id;
}

/** @param {string} id */
export function personalDef(id) {
  return PERSONAL_DEFS.find((d) => d.id === id) || null;
}
