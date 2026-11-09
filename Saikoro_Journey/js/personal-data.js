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
  {
    id: 'key_a02k001_mist_spur_scrap',
    name: 'Mist Spur Scrap',
    kind: 'key',
    desc: 'A dry scrap from the spur rail. Cool in the pocket.',
    description: 'A dry scrap from the spur rail. Cool in the pocket.',
    icon: '▤',
  },
  {
    id: 'key_a01k003_exit_ash_scrap',
    name: 'Exit Ash Scrap',
    kind: 'key',
    desc: 'A dry scrap from the ash threshold. Quiet in the pocket.',
    description: 'A dry scrap from the ash threshold. Quiet in the pocket.',
    icon: '▥',
  },
  {
    id: 'key_a01k004_scrap_gate_scrap',
    name: 'Scrap Gate Scrap',
    kind: 'key',
    desc: 'A dry scrap from the scrap gate. Hard in the pocket.',
    description: 'A dry scrap from the scrap gate. Hard in the pocket.',
    icon: '▱',
  },
  {
    id: 'key_a01k005_dune_crown_scrap',
    name: 'Dune Crown Scrap',
    kind: 'key',
    desc: 'A dry scrap from the dune crown. Gritty in the pocket.',
    description: 'A dry scrap from the dune crown. Gritty in the pocket.',
    icon: '▰',
  },
  {
    id: 'key_a01k006_star_gate_scrap',
    name: 'Star Gate Scrap',
    kind: 'key',
    desc: 'A dry scrap from the star gate. Cold in the pocket.',
    description: 'A dry scrap from the star gate. Cold in the pocket.',
    icon: '◆',
  },
  {
    id: 'key_a01k007_ash_pump_scrap',
    name: 'Ash Pump Scrap',
    kind: 'key',
    desc: 'A dry scrap from the ash pump. Dusty in the pocket.',
    description: 'A dry scrap from the ash pump. Dusty in the pocket.',
    icon: '◇',
  },
  {
    id: 'key_a01k008_rust_spur_scrap',
    name: 'Rust Spur Scrap',
    kind: 'key',
    desc: 'A dry scrap from the rust spur. Flaked in the pocket.',
    description: 'A dry scrap from the rust spur. Flaked in the pocket.',
    icon: '◊',
  },
  {
    id: 'key_a01k009_night_well_scrap',
    name: 'Night Well Scrap',
    kind: 'key',
    desc: 'A dry scrap from the night well. Dark in the pocket.',
    description: 'A dry scrap from the night well. Dark in the pocket.',
    icon: '●',
  },
  {
    id: 'key_a02k002_cobalt_gate_scrap',
    name: 'Cobalt Gate Scrap',
    kind: 'key',
    desc: 'A dry scrap from the cobalt latch. Dull in the pocket.',
    description: 'A dry scrap from the cobalt latch. Dull in the pocket.',
    icon: '▦',
  },
  {
    id: 'key_a02k003_quiet_pier_scrap',
    name: 'Quiet Pier Scrap',
    kind: 'key',
    desc: 'A dry scrap from the pier plank. Soft in the pocket.',
    description: 'A dry scrap from the pier plank. Soft in the pocket.',
    icon: '▧',
  },
  {
    id: 'key_a02k004_pale_lamp_scrap',
    name: 'Pale Lamp Scrap',
    kind: 'key',
    desc: 'A dry scrap from the lamp glass. Pale in the pocket.',
    description: 'A dry scrap from the lamp glass. Pale in the pocket.',
    icon: '▨',
  },
  {
    id: 'key_a02k005_reed_bank_scrap',
    name: 'Reed Bank Scrap',
    kind: 'key',
    desc: 'A dry scrap from the reed edge. Thin in the pocket.',
    description: 'A dry scrap from the reed edge. Thin in the pocket.',
    icon: '▩',
  },
  {
    id: 'key_a02k006_glass_fen_scrap',
    name: 'Glass Fen Scrap',
    kind: 'key',
    desc: 'A dry scrap from the fen glass. Clear in the pocket.',
    description: 'A dry scrap from the fen glass. Clear in the pocket.',
    icon: '▢',
  },
  {
    id: 'key_a02k007_iron_marsh_scrap',
    name: 'Iron Marsh Scrap',
    kind: 'key',
    desc: 'A dry scrap from the marsh iron. Rough in the pocket.',
    description: 'A dry scrap from the marsh iron. Rough in the pocket.',
    icon: '◧',
  },
  {
    id: 'key_a02k008_drift_yard_scrap',
    name: 'Drift Yard Scrap',
    kind: 'key',
    desc: 'A dry scrap from the yard drift. Loose in the pocket.',
    description: 'A dry scrap from the yard drift. Loose in the pocket.',
    icon: '◨',
  },
  {
    id: 'key_a02k009_high_loom_scrap',
    name: 'High Loom Scrap',
    kind: 'key',
    desc: 'A dry scrap from the loom thread. Tight in the pocket.',
    description: 'A dry scrap from the loom thread. Tight in the pocket.',
    icon: '◩',
  },
  {
    id: 'key_a02k010_silk_cut_scrap',
    name: 'Silk Cut Scrap',
    kind: 'key',
    desc: 'A dry scrap from the silk cut. Soft in the pocket.',
    description: 'A dry scrap from the silk cut. Soft in the pocket.',
    icon: '◪',
  },
  {
    id: 'key_a02k011_far_beacon_scrap',
    name: 'Far Beacon Scrap',
    kind: 'key',
    desc: 'A dry scrap from the beacon glass. Far in the pocket.',
    description: 'A dry scrap from the beacon glass. Far in the pocket.',
    icon: '◫',
  },
];

export const KEY_MIRROR_RESIDUE = 'key_a01k001_mirror_residue';
export const KEY_FOG_WELL_SCRAP = 'key_a01k002_fog_well_scrap';
export const KEY_MIST_SPUR_SCRAP = 'key_a02k001_mist_spur_scrap';
export const KEY_EXIT_ASH_SCRAP = 'key_a01k003_exit_ash_scrap';
export const KEY_SCRAP_GATE_SCRAP = 'key_a01k004_scrap_gate_scrap';
export const KEY_DUNE_CROWN_SCRAP = 'key_a01k005_dune_crown_scrap';
export const KEY_STAR_GATE_SCRAP = 'key_a01k006_star_gate_scrap';
export const KEY_ASH_PUMP_SCRAP = 'key_a01k007_ash_pump_scrap';
export const KEY_RUST_SPUR_SCRAP = 'key_a01k008_rust_spur_scrap';
export const KEY_NIGHT_WELL_SCRAP = 'key_a01k009_night_well_scrap';
export const KEY_COBALT_GATE_SCRAP = 'key_a02k002_cobalt_gate_scrap';
export const KEY_QUIET_PIER_SCRAP = 'key_a02k003_quiet_pier_scrap';
export const KEY_PALE_LAMP_SCRAP = 'key_a02k004_pale_lamp_scrap';
export const KEY_REED_BANK_SCRAP = 'key_a02k005_reed_bank_scrap';
export const KEY_GLASS_FEN_SCRAP = 'key_a02k006_glass_fen_scrap';
export const KEY_IRON_MARSH_SCRAP = 'key_a02k007_iron_marsh_scrap';
export const KEY_DRIFT_YARD_SCRAP = 'key_a02k008_drift_yard_scrap';
export const KEY_HIGH_LOOM_SCRAP = 'key_a02k009_high_loom_scrap';
export const KEY_SILK_CUT_SCRAP = 'key_a02k010_silk_cut_scrap';
export const KEY_FAR_BEACON_SCRAP = 'key_a02k011_far_beacon_scrap';

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
