import { TRAIN_SPEED, START_LOC, areaOfLoc, distanceBetween } from './map-data.js?v=z1-20261028cd';

/** @typedef {{ id: string, name: string, tags: string[], weightG: number, description: string, icon: string }} GoodDef */

/** Naming v2 goods_aAAzZZiIII_slug — name is display label. Live MP drifts around BASE_PRICES. */
/** @type {GoodDef[]} */
export const GOODS = [
  { id: 'goods_a01z01i001_dry_food', name: 'Dry Food', tags: [], weightG: 200, icon: '▣', description: 'Hardtack crates that keep on dusty rails.' },
  { id: 'goods_a01z01i002_oil_speciality', name: 'Oil Speciality', tags: ['volatile'], weightG: 500, icon: '◆', description: 'Sealed oil drums — volatile; condition drains on travel.' },
  { id: 'goods_a01z01i003_water_speciality', name: 'Water Speciality', tags: ['liquid'], weightG: 750, icon: '◇', description: 'Cistern water — liquid; condition drains on travel.' },
  // Slice AL — Area2 specialty goods
  { id: 'goods_a02z01i001_fog_reed', name: 'Fog Reed', tags: [], weightG: 250, icon: '▤', description: 'Baled marsh reed for packing and weave.' },
  { id: 'goods_a02z01i002_cobalt_silk', name: 'Cobalt Silk', tags: [], weightG: 300, icon: '✦', description: 'Cobalt-dyed silk bolts from the loom road.' },
];

export const BASE_PRICES = {
  loc_a01z01l001_broken_lamp: {
    goods_a01z01i001_dry_food: 8,
    goods_a01z01i002_oil_speciality: 40,
    goods_a01z01i003_water_speciality: 55,
    // Slice AL — sparse A1 import (cross-Area arb)
    goods_a02z01i001_fog_reed: 42,
    goods_a02z01i002_cobalt_silk: 110,
  },
  loc_a01z01l002_drywind_depot: {
    goods_a01z01i001_dry_food: 12,
    goods_a01z01i002_oil_speciality: 22,
    goods_a01z01i003_water_speciality: 45,
  },
  loc_a01z01l003_star_ash: {
    goods_a01z01i001_dry_food: 14,
    goods_a01z01i002_oil_speciality: 35,
    goods_a01z01i003_water_speciality: 28,
  },
  // Slice T — Z2 wider spreads (extreme oil/water between stops)
  loc_a01z02l001_deep_dune: {
    goods_a01z01i001_dry_food: 10,
    goods_a01z01i002_oil_speciality: 55,
    goods_a01z01i003_water_speciality: 20,
  },
  loc_a01z02l002_salt_glass: {
    goods_a01z01i001_dry_food: 18,
    goods_a01z01i002_oil_speciality: 18,
    goods_a01z01i003_water_speciality: 70,
  },
  loc_a01z02l003_night_well: {
    goods_a01z01i001_dry_food: 9,
    goods_a01z01i002_oil_speciality: 48,
    goods_a01z01i003_water_speciality: 15,
  },
  // Slice W — Z3 wider oil/water spreads (舊油路／遺址)
  loc_a01z03l001_rust_spur: {
    goods_a01z01i001_dry_food: 11,
    goods_a01z01i002_oil_speciality: 62,
    goods_a01z01i003_water_speciality: 18,
  },
  loc_a01z03l002_ash_pump: {
    goods_a01z01i001_dry_food: 20,
    goods_a01z01i002_oil_speciality: 16,
    goods_a01z01i003_water_speciality: 78,
  },
  loc_a01z03l003_scrap_gate: {
    goods_a01z01i001_dry_food: 8,
    goods_a01z01i002_oil_speciality: 58,
    goods_a01z01i003_water_speciality: 12,
  },
  // Slice X — Z4 extreme oil/water (沙漠核心／關口)
  loc_a01z04l001_dune_crown: {
    goods_a01z01i001_dry_food: 12,
    goods_a01z01i002_oil_speciality: 70,
    goods_a01z01i003_water_speciality: 14,
  },
  loc_a01z04l002_star_gate: {
    goods_a01z01i001_dry_food: 22,
    goods_a01z01i002_oil_speciality: 14,
    goods_a01z01i003_water_speciality: 85,
    goods_a02z01i001_fog_reed: 48,
    goods_a02z01i002_cobalt_silk: 100,
  },
  loc_a01z04l003_exit_ash: {
    goods_a01z01i001_dry_food: 7,
    goods_a01z01i002_oil_speciality: 65,
    goods_a01z01i003_water_speciality: 10,
    goods_a02z01i001_fog_reed: 50,
    goods_a02z01i002_cobalt_silk: 105,
  },
  // Slice AG — Area2 wider oil/water spreads
  loc_a02z01l001_mist_spur: {
    goods_a01z01i001_dry_food: 10,
    goods_a01z01i002_oil_speciality: 72,
    goods_a01z01i003_water_speciality: 16,
    // Slice AL — Fog Reed mid-source; Cobalt Silk expensive import
    goods_a02z01i001_fog_reed: 28,
    goods_a02z01i002_cobalt_silk: 95,
  },
  loc_a02z01l002_fog_well: {
    goods_a01z01i001_dry_food: 19,
    goods_a01z01i002_oil_speciality: 15,
    goods_a01z01i003_water_speciality: 88,
    goods_a02z01i001_fog_reed: 18,
    goods_a02z01i002_cobalt_silk: 88,
  },
  loc_a02z01l003_pale_lamp: {
    goods_a01z01i001_dry_food: 8,
    goods_a01z01i002_oil_speciality: 68,
    goods_a01z01i003_water_speciality: 11,
    goods_a02z01i001_fog_reed: 32,
    goods_a02z01i002_cobalt_silk: 82,
  },
  loc_a02z02l001_reed_bank: {
    goods_a01z01i001_dry_food: 13,
    goods_a01z01i002_oil_speciality: 74,
    goods_a01z01i003_water_speciality: 13,
    goods_a02z01i001_fog_reed: 16,
    goods_a02z01i002_cobalt_silk: 75,
  },
  loc_a02z02l002_glass_fen: {
    goods_a01z01i001_dry_food: 21,
    goods_a01z01i002_oil_speciality: 13,
    goods_a01z01i003_water_speciality: 90,
    goods_a02z01i001_fog_reed: 35,
    goods_a02z01i002_cobalt_silk: 70,
  },
  loc_a02z02l003_quiet_pier: {
    goods_a01z01i001_dry_food: 7,
    goods_a01z01i002_oil_speciality: 70,
    goods_a01z01i003_water_speciality: 9,
    goods_a02z01i001_fog_reed: 42,
    goods_a02z01i002_cobalt_silk: 92,
  },
  loc_a02z03l001_iron_marsh: {
    goods_a01z01i001_dry_food: 14,
    goods_a01z01i002_oil_speciality: 78,
    goods_a01z01i003_water_speciality: 12,
    goods_a02z01i001_fog_reed: 22,
    goods_a02z01i002_cobalt_silk: 65,
  },
  loc_a02z03l002_drift_yard: {
    goods_a01z01i001_dry_food: 23,
    goods_a01z01i002_oil_speciality: 12,
    goods_a01z01i003_water_speciality: 92,
    goods_a02z01i001_fog_reed: 38,
    goods_a02z01i002_cobalt_silk: 55,
  },
  loc_a02z03l003_cobalt_gate: {
    goods_a01z01i001_dry_food: 6,
    goods_a01z01i002_oil_speciality: 76,
    goods_a01z01i003_water_speciality: 8,
    goods_a02z01i001_fog_reed: 48,
    goods_a02z01i002_cobalt_silk: 42,
  },
  loc_a02z04l001_high_loom: {
    goods_a01z01i001_dry_food: 15,
    goods_a01z01i002_oil_speciality: 80,
    goods_a01z01i003_water_speciality: 11,
    goods_a02z01i001_fog_reed: 55,
    goods_a02z01i002_cobalt_silk: 38,
  },
  loc_a02z04l002_silk_cut: {
    goods_a01z01i001_dry_food: 24,
    goods_a01z01i002_oil_speciality: 11,
    goods_a01z01i003_water_speciality: 95,
    goods_a02z01i001_fog_reed: 62,
    goods_a02z01i002_cobalt_silk: 35,
  },
  loc_a02z04l003_far_beacon: {
    goods_a01z01i001_dry_food: 6,
    goods_a01z01i002_oil_speciality: 82,
    goods_a01z01i003_water_speciality: 7,
    goods_a02z01i001_fog_reed: 58,
    goods_a02z01i002_cobalt_silk: 48,
  },
};

/** Slice L — slow MP drift around base (prototype-z1 appendix). */
export const PRICE_DRIFT_INTERVAL_MS = 5000;
/** Each interval: random nudge in [-max,+max] as fraction of base MP. */
export const PRICE_DRIFT_PCT_MAX = 0.02;
/** Soft clamp band around base while drifting. */
export const PRICE_DRIFT_BAND = 0.15;

/** Slice M — buy/sell impact windows (prototype-z1 / economy §3.2). */
export const IMPACT_WINDOW_MS = 10000;
export const BUY_IMPACT_QTY = 100;
export const SELL_IMPACT_QTY = 150;
/** Max uplift above base from buy impact. */
export const BUY_IMPACT_CAP = 0.25;
/** Max drop below base from sell impact. */
export const SELL_IMPACT_CAP = 0.15;
/** Push/crush step as fraction of base when threshold exceeded. */
export const BUY_IMPACT_STEP = 0.03;
export const SELL_IMPACT_STEP = 0.015;
/** Per drift tick, fraction of base pulled back toward drift band when outside it. */
export const IMPACT_RECOVERY_STEP = 0.01;

/** Slice AO — Area property lite (systems §1.1). Static; no SAVE bump. */
export const AREA_PROPERTIES = {
  1: {
    id: 1,
    climate: 'Ash desert',
    blurb: 'Hot ash flats; prices wander hard.',
    driftAmp: 1.25,
    sellTaxPct: 0,
    /** Slice AT — body-train haul gold per distance unit (origin area). */
    freightPerDist: 1.5,
  },
  2: {
    id: 2,
    climate: 'Mist fen',
    blurb: 'Damp fen road; quieter markets, light toll.',
    driftAmp: 0.75,
    sellTaxPct: 0.025,
    freightPerDist: 1.0,
  },
};

/** @param {string} locId */
export function areaPropertyForLoc(locId) {
  const a = areaOfLoc(locId);
  return (a && AREA_PROPERTIES[a]) || AREA_PROPERTIES[1];
}

/**
 * Slice AT — body-train freight gold for a hop (origin area's freightPerDist).
 * @param {string} fromId
 * @param {string} toId
 * @returns {number|null} rounded gold, or null if no edge
 */
export function travelFreightCost(fromId, toId) {
  const d = distanceBetween(fromId, toId);
  if (d == null || !(d > 0)) return null;
  const prop = areaPropertyForLoc(fromId);
  const rate = Number(prop && prop.freightPerDist);
  if (!(rate > 0)) return 0;
  return Math.round(d * rate);
}

/** Soft capacity gate: Exit Ash ↔ Mist Spur. */
export const AREA_BRIDGE_A = 'loc_a01z04l003_exit_ash';
export const AREA_BRIDGE_B = 'loc_a02z01l001_mist_spur';
export const AREA_BRIDGE_MIN_CAPACITY_LEVEL = 1;

export function isAreaBridgeEdge(fromId, toId) {
  return (
    (fromId === AREA_BRIDGE_A && toId === AREA_BRIDGE_B) ||
    (fromId === AREA_BRIDGE_B && toId === AREA_BRIDGE_A)
  );
}

/**
 * @param {{ capacityLevel?: number }} s
 * @param {string} fromId
 * @param {string} toId
 * @returns {string|null} blocked reason tooltip, or null if ok
 */
export function areaBridgeBlockReason(s, fromId, toId) {
  if (!isAreaBridgeEdge(fromId, toId)) return null;
  if ((s.capacityLevel | 0) >= AREA_BRIDGE_MIN_CAPACITY_LEVEL) return null;
  return 'Need Capacity Lv1 to cross Exit Ash ↔ Mist Spur';
}


export const START_GOLD = 200;
/** Base cargo capacity (g). Upgrades: +20% of base per level, max level 5 → 10000g. */
export const CAPACITY_BASE = 5000;
export const CAPACITY_MAX_LEVEL = 5;
/** Stub gold cost for next upgrade: 500 × (level+1). */
export const CAPACITY_UPGRADE_GOLD = 500;

/** Effective capacity grams for capacityLevel 0..5 → 5k/6k/7k/8k/9k/10k. */
export function effectiveCapacity(level) {
  const lv = Math.max(0, Math.min(CAPACITY_MAX_LEVEL, Math.floor(Number(level) || 0)));
  return Math.round(CAPACITY_BASE * (1 + 0.2 * lv));
}

/** Gold cost to buy upgrade from current level → level+1 (stub pricing). */
export function capacityUpgradeCost(level) {
  const lv = Math.max(0, Math.min(CAPACITY_MAX_LEVEL, Math.floor(Number(level) || 0)));
  return CAPACITY_UPGRADE_GOLD * (lv + 1);
}

/** Starter cargo capacity in grams (capacityLevel 0). Synced via effectiveCapacity. */
export const CAPACITY = CAPACITY_BASE;

/**
 * Slice Z — Preserve rate upgrades (systems.md §3.1b–3.1c).
 * Multiplier on base depleteRateForGood: factor = 1 − 0.12×level
 * level 0..5 → 1.00 / 0.88 / 0.76 / 0.64 / 0.52 / 0.40
 * Stub gold: 600 × (level+1) (slightly above capacity’s 500×).
 */
export const PRESERVE_MAX_LEVEL = 5;
export const PRESERVE_UPGRADE_GOLD = 600;

/** Drain multiplier for preserveLevel (clamped 0..5). */
export function preserveDrainFactor(level) {
  const lv = Math.max(0, Math.min(PRESERVE_MAX_LEVEL, Math.floor(Number(level) || 0)));
  return 1 - 0.12 * lv;
}

/** Effective deplete rate after preserve upgrade. Base rates stay in depleteRateForGood. */
export function effectiveDepleteRate(goodId, level) {
  return depleteRateForGood(goodId) * preserveDrainFactor(level);
}

/** Gold cost to buy preserve upgrade from current level → level+1. */
export function preserveUpgradeCost(level) {
  const lv = Math.max(0, Math.min(PRESERVE_MAX_LEVEL, Math.floor(Number(level) || 0)));
  return PRESERVE_UPGRADE_GOLD * (lv + 1);
}

/**
 * Slice AA — Speed upgrades (systems.md §3.1b).
 * effectiveSpeed = TRAIN_SPEED × (1 + 0.2×level) → 10/12/14/16/18/20 at lv 0–5 (2× at max).
 * Stub gold: 550 × (level+1). Slice AH: mid-travel upgrade recalcs remaining ETA (choice A).
 */
export const SPEED_MAX_LEVEL = 5;
export const SPEED_UPGRADE_GOLD = 550;

/** Effective travel speed for speedLevel (clamped 0..5). */
export function effectiveSpeed(level) {
  const lv = Math.max(0, Math.min(SPEED_MAX_LEVEL, Math.floor(Number(level) || 0)));
  return TRAIN_SPEED * (1 + 0.2 * lv);
}

/** Gold cost to buy speed upgrade from current level → level+1. */
export function speedUpgradeCost(level) {
  const lv = Math.max(0, Math.min(SPEED_MAX_LEVEL, Math.floor(Number(level) || 0)));
  return SPEED_UPGRADE_GOLD * (lv + 1);
}

/**
 * Slice T/W/X — data-driven unlocks (multi-trip deposit; starter 5000g, max 10000g).
 * Rule:
 *  1) Star Ash: oil×5 + dry×10 (fits starter; any unlocked station).
 *  2) Deep Dune (first Z2): after Star Ash — oil×25 + water×10 + dry×25 = 25000g (~2–3 trips at max cargo).
 *  3) Salt Glass: after Deep Dune — oil×10 + dry×15 = 8000g (multi-trip deposit).
 *  4) Night Well: after Salt Glass — oil×10 + water×8 = 11000g (multi-trip deposit).
 *  5) Rust Spur (first Z3): after Night Well — oil×30 + water×12 + dry×25 = 29000g (~2–3 trips at max).
 *  6) Ash Pump: after Rust Spur — oil×12 + dry×20 = 10000g (multi-trip deposit).
 *  7) Scrap Gate: after Ash Pump — oil×12 + water×10 = 13500g (multi-trip deposit).
 *  8) Dune Crown (first Z4): after Scrap Gate — oil×32 + water×14 + dry×28 = 32100g (~3× max).
 *  9) Star Gate: after Dune Crown — oil×14 + dry×22 = 11400g (multi-trip deposit).
 * 10) Exit Ash: after Star Gate — oil×14 + water×12 = 16000g (multi-trip deposit).
 * Slice AG — Area2 (after Exit Ash; oil=500g water=750g dry=200g):
 * 11) Mist Spur (A2Z1): oil×30 + water×12 + dry×25 = 29000g (~2–3× max).
 * 12) Fog Well: oil×12 + dry×20 = 10000g.
 * 13) Pale Lamp: oil×12 + water×10 = 13500g.
 * 14) Reed Bank (A2Z2): oil×30 + water×12 + dry×25 = 29000g.
 * 15) Glass Fen: oil×12 + dry×20 = 10000g.
 * 16) Quiet Pier: oil×12 + water×10 = 13500g.
 * 17) Iron Marsh (A2Z3): oil×32 + water×14 + dry×28 = 32100g.
 * 18) Drift Yard: oil×14 + dry×22 = 11400g.
 * 19) Cobalt Gate: oil×14 + water×12 = 16000g.
 * 20) High Loom (A2Z4): oil×32 + water×14 + dry×28 = 32100g.
 * 21) Silk Cut: oil×14 + dry×22 = 11400g.
 * 22) Far Beacon: oil×14 + water×12 = 16000g.
 * Hand-in at any unlocked station via unlockDeposits (UI lists next available).
 * @type {{ target: string, requiresUnlocked: string[], costs: { goodId: string, qty: number }[] }[]}
 */
export const UNLOCKS = [
  {
    target: 'loc_a01z01l003_star_ash',
    requiresUnlocked: [],
    costs: [
      { goodId: 'goods_a01z01i002_oil_speciality', qty: 5 },
      { goodId: 'goods_a01z01i001_dry_food', qty: 10 },
    ],
  },
  {
    target: 'loc_a01z02l001_deep_dune',
    requiresUnlocked: ['loc_a01z01l003_star_ash'],
    costs: [
      { goodId: 'goods_a01z01i002_oil_speciality', qty: 25 },
      { goodId: 'goods_a01z01i003_water_speciality', qty: 10 },
      { goodId: 'goods_a01z01i001_dry_food', qty: 25 },
    ],
  },
  {
    target: 'loc_a01z02l002_salt_glass',
    requiresUnlocked: ['loc_a01z02l001_deep_dune'],
    costs: [
      { goodId: 'goods_a01z01i002_oil_speciality', qty: 10 },
      { goodId: 'goods_a01z01i001_dry_food', qty: 15 },
    ],
  },
  {
    target: 'loc_a01z02l003_night_well',
    requiresUnlocked: ['loc_a01z02l002_salt_glass'],
    costs: [
      { goodId: 'goods_a01z01i002_oil_speciality', qty: 10 },
      { goodId: 'goods_a01z01i003_water_speciality', qty: 8 },
    ],
  },
  {
    target: 'loc_a01z03l001_rust_spur',
    requiresUnlocked: ['loc_a01z02l003_night_well'],
    costs: [
      { goodId: 'goods_a01z01i002_oil_speciality', qty: 30 },
      { goodId: 'goods_a01z01i003_water_speciality', qty: 12 },
      { goodId: 'goods_a01z01i001_dry_food', qty: 25 },
    ],
  },
  {
    target: 'loc_a01z03l002_ash_pump',
    requiresUnlocked: ['loc_a01z03l001_rust_spur'],
    costs: [
      { goodId: 'goods_a01z01i002_oil_speciality', qty: 12 },
      { goodId: 'goods_a01z01i001_dry_food', qty: 20 },
    ],
  },
  {
    target: 'loc_a01z03l003_scrap_gate',
    requiresUnlocked: ['loc_a01z03l002_ash_pump'],
    costs: [
      { goodId: 'goods_a01z01i002_oil_speciality', qty: 12 },
      { goodId: 'goods_a01z01i003_water_speciality', qty: 10 },
    ],
  },
  {
    target: 'loc_a01z04l001_dune_crown',
    requiresUnlocked: ['loc_a01z03l003_scrap_gate'],
    costs: [
      { goodId: 'goods_a01z01i002_oil_speciality', qty: 32 },
      { goodId: 'goods_a01z01i003_water_speciality', qty: 14 },
      { goodId: 'goods_a01z01i001_dry_food', qty: 28 },
    ],
  },
  {
    target: 'loc_a01z04l002_star_gate',
    requiresUnlocked: ['loc_a01z04l001_dune_crown'],
    costs: [
      { goodId: 'goods_a01z01i002_oil_speciality', qty: 14 },
      { goodId: 'goods_a01z01i001_dry_food', qty: 22 },
    ],
  },
  {
    target: 'loc_a01z04l003_exit_ash',
    requiresUnlocked: ['loc_a01z04l002_star_gate'],
    costs: [
      { goodId: 'goods_a01z01i002_oil_speciality', qty: 14 },
      { goodId: 'goods_a01z01i003_water_speciality', qty: 12 },
    ],
  },
  // Slice AG — Area2 sequential unlocks
  {
    target: 'loc_a02z01l001_mist_spur',
    requiresUnlocked: ['loc_a01z04l003_exit_ash'],
    costs: [
      { goodId: 'goods_a01z01i002_oil_speciality', qty: 30 },
      { goodId: 'goods_a01z01i003_water_speciality', qty: 12 },
      { goodId: 'goods_a01z01i001_dry_food', qty: 25 },
    ],
  },
  {
    target: 'loc_a02z01l002_fog_well',
    requiresUnlocked: ['loc_a02z01l001_mist_spur'],
    costs: [
      { goodId: 'goods_a01z01i002_oil_speciality', qty: 12 },
      { goodId: 'goods_a01z01i001_dry_food', qty: 20 },
    ],
  },
  {
    target: 'loc_a02z01l003_pale_lamp',
    requiresUnlocked: ['loc_a02z01l002_fog_well'],
    costs: [
      { goodId: 'goods_a01z01i002_oil_speciality', qty: 12 },
      { goodId: 'goods_a01z01i003_water_speciality', qty: 10 },
    ],
  },
  {
    target: 'loc_a02z02l001_reed_bank',
    requiresUnlocked: ['loc_a02z01l003_pale_lamp'],
    costs: [
      { goodId: 'goods_a01z01i002_oil_speciality', qty: 30 },
      { goodId: 'goods_a01z01i003_water_speciality', qty: 12 },
      { goodId: 'goods_a01z01i001_dry_food', qty: 25 },
    ],
  },
  {
    target: 'loc_a02z02l002_glass_fen',
    requiresUnlocked: ['loc_a02z02l001_reed_bank'],
    costs: [
      { goodId: 'goods_a01z01i002_oil_speciality', qty: 12 },
      { goodId: 'goods_a01z01i001_dry_food', qty: 20 },
    ],
  },
  {
    target: 'loc_a02z02l003_quiet_pier',
    requiresUnlocked: ['loc_a02z02l002_glass_fen'],
    costs: [
      { goodId: 'goods_a01z01i002_oil_speciality', qty: 12 },
      { goodId: 'goods_a01z01i003_water_speciality', qty: 10 },
    ],
  },
  {
    target: 'loc_a02z03l001_iron_marsh',
    requiresUnlocked: ['loc_a02z02l003_quiet_pier'],
    costs: [
      { goodId: 'goods_a01z01i002_oil_speciality', qty: 32 },
      { goodId: 'goods_a01z01i003_water_speciality', qty: 14 },
      { goodId: 'goods_a01z01i001_dry_food', qty: 28 },
    ],
  },
  {
    target: 'loc_a02z03l002_drift_yard',
    requiresUnlocked: ['loc_a02z03l001_iron_marsh'],
    costs: [
      { goodId: 'goods_a01z01i002_oil_speciality', qty: 14 },
      { goodId: 'goods_a01z01i001_dry_food', qty: 22 },
    ],
  },
  {
    target: 'loc_a02z03l003_cobalt_gate',
    requiresUnlocked: ['loc_a02z03l002_drift_yard'],
    costs: [
      { goodId: 'goods_a01z01i002_oil_speciality', qty: 14 },
      { goodId: 'goods_a01z01i003_water_speciality', qty: 12 },
    ],
  },
  {
    target: 'loc_a02z04l001_high_loom',
    requiresUnlocked: ['loc_a02z03l003_cobalt_gate'],
    costs: [
      { goodId: 'goods_a01z01i002_oil_speciality', qty: 32 },
      { goodId: 'goods_a01z01i003_water_speciality', qty: 14 },
      { goodId: 'goods_a01z01i001_dry_food', qty: 28 },
    ],
  },
  {
    target: 'loc_a02z04l002_silk_cut',
    requiresUnlocked: ['loc_a02z04l001_high_loom'],
    costs: [
      { goodId: 'goods_a01z01i002_oil_speciality', qty: 14 },
      { goodId: 'goods_a01z01i001_dry_food', qty: 22 },
    ],
  },
  {
    target: 'loc_a02z04l003_far_beacon',
    requiresUnlocked: ['loc_a02z04l002_silk_cut'],
    costs: [
      { goodId: 'goods_a01z01i002_oil_speciality', qty: 14 },
      { goodId: 'goods_a01z01i003_water_speciality', qty: 12 },
    ],
  },
];

/** @deprecated Slice A–S alias — prefer UNLOCKS[0] / availableUnlocks(). */
export const UNLOCK_LOC3 = UNLOCKS[0];

/** Unlocks whose prereqs are met and target not yet unlocked. */
export function availableUnlocks(unlockedIds) {
  const have = new Set(unlockedIds || []);
  return UNLOCKS.filter((u) => {
    if (have.has(u.target)) return false;
    return (u.requiresUnlocked || []).every((id) => have.has(id));
  });
}

/** Lookup unlock def by target id. */
export function unlockByTarget(targetId) {
  return UNLOCKS.find((u) => u.target === targetId) || null;
}

/** @param {string} id */
export function goodName(id) {
  return GOODS.find((g) => g.id === id)?.name || id;
}

/** Weight in grams for one unit. @param {string} id */
export function goodWeightG(id) {
  return GOODS.find((g) => g.id === id)?.weightG || 0;
}

/** @param {string} id */
export function goodTags(id) {
  return GOODS.find((g) => g.id === id)?.tags || [];
}

/** @param {string} id */
export function goodDescription(id) {
  return GOODS.find((g) => g.id === id)?.description || '';
}

/** Mono glyph icon for a good. @param {string} id */
export function goodIcon(id) {
  return GOODS.find((g) => g.id === id)?.icon || '□';
}

/** Full GoodDef or null. @param {string} id */
export function goodDef(id) {
  return GOODS.find((g) => g.id === id) || null;
}

/**
 * Slice N — condition deplete rates (% condition lost per distance unit traveled).
 * Docs: liquid/volatile each have a rate; exact numbers TBD → tunable prototype.
 */
export const DEPLETE_RATE_BY_TAG = {
  volatile: 0.15, // ~15% per 100 dist (oil)
  liquid: 0.08, // ~8% per 100 dist (water)
};

/** Highest matching tag rate, or 0 if no depleting tags. */
export function depleteRateForGood(goodId) {
  const tags = goodTags(goodId);
  let rate = 0;
  for (const tag of tags) {
    const r = DEPLETE_RATE_BY_TAG[tag];
    if (r != null && r > rate) rate = r;
  }
  return rate;
}

/** Sell multiplier from condition % (systems.md §3.1c bands). */
export function sellMulFromCondition(conditionPct) {
  const c = conditionPct == null ? 100 : conditionPct;
  if (c <= 0) return 0;
  if (c >= 90) return 1;
  if (c >= 50) return 0.6;
  // 49–1% → ~59% → 10% MP
  return 0.1 + (c / 49) * 0.49;
}

/**
 * Slice H/J/K — mid-travel stop / re-route.
 * When true: Stop + Destinations + panel Travel + map Travel chip all re-route.
 * Live default false. Playtest: hard-reload with ?rr=1 (or &rr=1) forces unlock.
 */
const STOP_REROUTE_DEFAULT = false;

function rrQueryForcesUnlock() {
  try {
    const v = new URLSearchParams(globalThis.location?.search || '').get('rr');
    return v === '1' || v === 'true';
  } catch {
    return false;
  }
}

export const STOP_REROUTE_UNLOCKED = STOP_REROUTE_DEFAULT || rrQueryForcesUnlock();


/**
 * Slice Q — Zone1 courier MVP (systems.md §4 / economy.md §8 thin).
 * Hire is FREE (teaching unlock after Star Ash); seed gold modest; capacity < player.
 */
export const COURIER_UNLOCK_LOC = 'loc_a01z01l003_star_ash';
/** Slice AD — universal courier unlock when Scrap Gate first unlocks. */
export const UNIVERSAL_COURIER_UNLOCK_LOC = 'loc_a01z03l003_scrap_gate';
/** Slice Q: free hire for teaching MVP (not a gold sink). */
export const COURIER_HIRE_COST = 0;
export const COURIER_SEED_GOLD = 300;
export const COURIER_CAPACITY = 3000;

/**
 * Slice AB — Area1 warehouse / safe house (systems.md §4.1).
 * Hub = Broken Lamp (START_LOC). Panel-at-hub only — no new map node.
 * Soft cap 20000g total warehouse mass (goods only; no gold / no quest lots).
 */
export const AREA1_WAREHOUSE_LOC = START_LOC;
export const AREA1_WAREHOUSE_CAP = 20000;

/**
 * Slice AG — Area2 warehouse / safe house.
 * Hub = Mist Spur. Separate stock from Area1; same soft cap.
 */
export const AREA2_WAREHOUSE_LOC = 'loc_a02z01l001_mist_spur';
export const AREA2_WAREHOUSE_CAP = AREA1_WAREHOUSE_CAP;
/** Alias used by shared warehouse helpers. */
export const WAREHOUSE_CAP = AREA1_WAREHOUSE_CAP;

/**
 * Slice O — A→B transport quests (economy.md §5 / systems.md §5 / map-area1 §4).
 * Flat modest gold rewards (teaching / safety net, not arb replacement).
 * @type {Record<string, { to: string, goodId: string, qty: number, rewardGold: number }>}
 */
export const TRANSPORT_QUESTS = {
  loc_a01z01l001_broken_lamp: {
    to: 'loc_a01z01l002_drywind_depot',
    goodId: 'goods_a01z01i001_dry_food',
    qty: 5,
    rewardGold: 60, // ~dry MP×5 teaching payout
  },
  loc_a01z01l002_drywind_depot: {
    to: 'loc_a01z01l001_broken_lamp',
    goodId: 'goods_a01z01i003_water_speciality',
    qty: 2,
    rewardGold: 80,
  },
  loc_a01z01l003_star_ash: {
    to: 'loc_a01z01l002_drywind_depot',
    goodId: 'goods_a01z01i001_dry_food',
    qty: 5,
    rewardGold: 70,
  },
  // Slice T — optional Z2 offer
  loc_a01z02l001_deep_dune: {
    to: 'loc_a01z02l002_salt_glass',
    goodId: 'goods_a01z01i001_dry_food',
    qty: 4,
    rewardGold: 90,
  },
  // Slice W — optional Z3 offer (oil flavour)
  loc_a01z03l001_rust_spur: {
    to: 'loc_a01z03l002_ash_pump',
    goodId: 'goods_a01z01i002_oil_speciality',
    qty: 3,
    rewardGold: 110,
  },
  // Slice AI — deeper A1 Z3 (Ash Pump → Scrap Gate); water×2 = 1500g
  loc_a01z03l002_ash_pump: {
    to: 'loc_a01z03l003_scrap_gate',
    goodId: 'goods_a01z01i003_water_speciality',
    qty: 2,
    rewardGold: 115,
  },
  // Slice X — optional Z4 offer
  loc_a01z04l001_dune_crown: {
    to: 'loc_a01z04l002_star_gate',
    goodId: 'goods_a01z01i001_dry_food',
    qty: 5,
    rewardGold: 120,
  },
  // Slice AI — deeper A1 Z4 (Star Gate → Exit Ash); dry×5 = 1000g
  loc_a01z04l002_star_gate: {
    to: 'loc_a01z04l003_exit_ash',
    goodId: 'goods_a01z01i001_dry_food',
    qty: 5,
    rewardGold: 125,
  },
  // Slice AI — A1→A2 bridge (Exit Ash → Mist Spur); oil×2 = 1000g
  loc_a01z04l003_exit_ash: {
    to: 'loc_a02z01l001_mist_spur',
    goodId: 'goods_a01z01i002_oil_speciality',
    qty: 2,
    rewardGold: 130,
  },
  // Slice AI — A2Z1 (Mist Spur → Fog Well); dry×5 = 1000g
  loc_a02z01l001_mist_spur: {
    to: 'loc_a02z01l002_fog_well',
    goodId: 'goods_a01z01i001_dry_food',
    qty: 5,
    rewardGold: 130,
  },
  // Slice AI — A2Z1 (Fog Well → Pale Lamp); water×2 = 1500g
  loc_a02z01l002_fog_well: {
    to: 'loc_a02z01l003_pale_lamp',
    goodId: 'goods_a01z01i003_water_speciality',
    qty: 2,
    rewardGold: 140,
  },
  // Slice AI — A2Z2 (Reed Bank → Glass Fen); oil×3 = 1500g
  loc_a02z02l001_reed_bank: {
    to: 'loc_a02z02l002_glass_fen',
    goodId: 'goods_a01z01i002_oil_speciality',
    qty: 3,
    rewardGold: 150,
  },
  // Slice AM — A2 specialty transport (Fog Reed / Cobalt Silk); new from-locs only
  // Reed cheap@Iron Marsh → dear@Silk Cut
  loc_a02z03l001_iron_marsh: {
    to: 'loc_a02z04l002_silk_cut',
    goodId: 'goods_a02z01i001_fog_reed',
    qty: 7, // 1750g mid-capacity
    rewardGold: 160,
  },
  // Silk cheap@Silk Cut → dear@Mist Spur
  loc_a02z04l002_silk_cut: {
    to: 'loc_a02z01l001_mist_spur',
    goodId: 'goods_a02z01i002_cobalt_silk',
    qty: 6, // 1800g
    rewardGold: 175,
  },
  // Silk cheap@Cobalt Gate → dear@Quiet Pier
  loc_a02z03l003_cobalt_gate: {
    to: 'loc_a02z02l003_quiet_pier',
    goodId: 'goods_a02z01i002_cobalt_silk',
    qty: 5, // 1500g
    rewardGold: 155,
  },
};
