/** Slice U — personal / key-item inventory (not trade goods; no cargo weight). */

/**
 * @typedef {{ id: string, name: string, kind: 'key' | 'item', desc: string, description?: string, icon: string }} PersonalDef
 */

/** Naming v2: key_a01k001_<slug> / item_a01i001_<slug> */
/** @type {PersonalDef[]} */
export const PERSONAL_DEFS = [
  {
    id: 'key_a01k001_mirror_residue',
    name: 'Mirror Residue',
    kind: 'key',
    desc: 'A flake of glass that won’t forget the wrong face.',
    description: 'A flake of glass that won’t forget the wrong face.',
    icon: '◈',
  },
  {
    id: 'key_a01k002_fog_well_scrap',
    name: 'Fog Well Scrap',
    kind: 'key',
    desc: 'A dry scrap from the well rim. Warm in the pocket.',
    description: 'A dry scrap from the well rim. Warm in the pocket.',
    icon: '▣',
  },
];

export const KEY_MIRROR_RESIDUE = 'key_a01k001_mirror_residue';
export const KEY_FOG_WELL_SCRAP = 'key_a01k002_fog_well_scrap';

/** @param {string} id */
export function personalName(id) {
  return PERSONAL_DEFS.find((d) => d.id === id)?.name || id;
}

/** @param {string} id */
export function personalDef(id) {
  return PERSONAL_DEFS.find((d) => d.id === id) || null;
}

/** @param {string} id */
export function personalIcon(id) {
  return PERSONAL_DEFS.find((d) => d.id === id)?.icon || '○';
}

/** Hover description (falls back to desc). @param {string} id */
export function personalDescription(id) {
  const d = PERSONAL_DEFS.find((x) => x.id === id);
  if (!d) return '';
  return d.description || d.desc || '';
}
