/** @typedef {{ id: string, name: string, tags: string[], weightG: number }} GoodDef */

/** Naming v2 goods_aAAzZZiIII_slug — name is display label. Live MP drifts around BASE_PRICES. */
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

/** @param {string} id */
export function goodTags(id) {
  return GOODS.find((g) => g.id === id)?.tags || [];
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
/** Slice Q: free hire for teaching MVP (not a gold sink). */
export const COURIER_HIRE_COST = 0;
export const COURIER_SEED_GOLD = 300;
export const COURIER_CAPACITY = 3000;

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
};
