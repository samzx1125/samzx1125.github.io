/** @typedef {{ id: string, name: string, tags: string[] }} GoodDef */

/** Naming v2 goods_aAAzZZiIII_slug — name is display label. Prices static. */
/** @type {GoodDef[]} */
export const GOODS = [
  { id: 'goods_a01z01i001_dry_food', name: 'Dry Food', tags: [] },
  { id: 'goods_a01z01i002_oil_speciality', name: 'Oil Speciality', tags: ['volatile'] },
  { id: 'goods_a01z01i003_water_speciality', name: 'Water Speciality', tags: ['liquid'] },
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
export const CAPACITY = 20;

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
