/** @typedef {{ id: string, name: string, tags: string[] }} GoodDef */

/** Display name = id (obvious placeholders). */
/** @type {GoodDef[]} */
export const GOODS = [
  { id: 'area_1_item_1_dry_food', name: 'area_1_item_1_dry_food', tags: [] },
  { id: 'area_1_item_2_oil_speciality_1', name: 'area_1_item_2_oil_speciality_1', tags: ['volatile'] },
  { id: 'area_1_item_3_water_speciality_1', name: 'area_1_item_3_water_speciality_1', tags: ['liquid'] },
];

/** Base market prices by location × good (MP). */
export const BASE_PRICES = {
  area_1_zone_1_location_1: {
    area_1_item_1_dry_food: 8,
    area_1_item_2_oil_speciality_1: 40,
    area_1_item_3_water_speciality_1: 55,
  },
  area_1_zone_1_location_2: {
    area_1_item_1_dry_food: 12,
    area_1_item_2_oil_speciality_1: 22,
    area_1_item_3_water_speciality_1: 45,
  },
  area_1_zone_1_location_3: {
    area_1_item_1_dry_food: 14,
    area_1_item_2_oil_speciality_1: 35,
    area_1_item_3_water_speciality_1: 28,
  },
};

export const START_GOLD = 200;
export const CAPACITY = 20;

/** Drift: every ~5s, ±0–2% on each (loc, good). */
export const DRIFT_INTERVAL_MS = 5000;
export const DRIFT_MAX_PCT = 0.02;

/** Buy/sell impact windows (prototype-z1). */
export const IMPACT_WINDOW_MS = 10000;
export const BUY_IMPACT_THRESHOLD = 100;
export const SELL_IMPACT_THRESHOLD = 150;
export const BUY_IMPACT_CAP = 0.25;
export const SELL_IMPACT_CAP = 0.15;
export const IMPACT_DECAY_PER_SEC = 0.15;

/** Unlock location_3 at any unlocked station. */
export const UNLOCK_Z1C = {
  target: 'area_1_zone_1_location_3',
  costs: [
    { goodId: 'area_1_item_2_oil_speciality_1', qty: 5 },
    { goodId: 'area_1_item_1_dry_food', qty: 10 },
  ],
};
