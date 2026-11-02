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
 * Slice T — data-driven unlocks (multi-trip deposit; starter 5000g, max 10000g).
 * Rule:
 *  1) Star Ash: oil×5 + dry×10 (fits starter; any unlocked station).
 *  2) Deep Dune (first Z2): after Star Ash — oil×25 + water×10 + dry×25 = 25000g (~2–3 trips at max cargo).
 *  3) Salt Glass: after Deep Dune — oil×10 + dry×15 = 8000g (multi-trip deposit).
 *  4) Night Well: after Salt Glass — oil×10 + water×8 = 11000g (multi-trip deposit).
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
  // Slice T — optional Z2 offer
  loc_a01z02l001_deep_dune: {
    to: 'loc_a01z02l002_salt_glass',
    goodId: 'goods_a01z01i001_dry_food',
    qty: 4,
    rewardGold: 90,
  },
};
