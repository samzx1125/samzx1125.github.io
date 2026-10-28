/** @typedef {{ id: string, name: string, tags: string[], weightG: number }} GoodDef */

/** Naming v2 goods_aAAzZZiIII_slug — name is display label. Prices static. */
/** @type {GoodDef[]} */
export const GOODS = [
  { id: 'goods_a01z01i001_dry_food', name: 'Dry Food', tags: [], weightG: 200 },
  { id: 'goods_a01z01i002_oil_speciality', name: 'Oil Speciality', tags: ['volatile'], weightG: 500 },
  { id: 'goods_a01z01i003_water_speciality', name: 'Water Speciality', tags: ['liquid'], weightG: 750 },
];

export const BASE_PRICES = {
  loc_a01z01l001_broken_lamp: {
    goods_a01z01i001_dry_food: 8,
    goods_a01z01i002_oil_speciality: 40,
    goods_a01z01i003_water_speciality: 55,
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
};

export const START_GOLD = 200;
/** Cargo capacity in grams (total weight). */
export const CAPACITY = 5000;

/** Unlock loc_a01z01l003 at any unlocked station. */
export const UNLOCK_LOC3 = {
  target: 'loc_a01z01l003_star_ash',
  costs: [
    { goodId: 'goods_a01z01i002_oil_speciality', qty: 5 },
    { goodId: 'goods_a01z01i001_dry_food', qty: 10 },
  ],
};

/** @param {string} id */
export function goodName(id) {
  return GOODS.find((g) => g.id === id)?.name || id;
}

/** Weight in grams for one unit. @param {string} id */
export function goodWeightG(id) {
  return GOODS.find((g) => g.id === id)?.weightG || 0;
}

/**
 * Slice H — mid-travel stop / re-route.
 * Feature is implemented but gated until later unlock (keep false).
 */
export const STOP_REROUTE_UNLOCKED = false;
