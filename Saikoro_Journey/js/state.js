import { LOCATIONS, INITIALLY_UNLOCKED, START_LOC } from './map-data.js?v=z1-20261028bz';
import { GOODS, BASE_PRICES, START_GOLD, CAPACITY, effectiveCapacity, goodWeightG, COURIER_CAPACITY, AREA1_WAREHOUSE_LOC, AREA2_WAREHOUSE_LOC } from './economy-data.js?v=z1-20261028bz';

/**
 * Slice AE — price-split cargo stacks.
 * @typedef {{ id: string, goodId: string, unitPrice: number, qty: number, condition: number }} CargoStack
 *
 * @typedef {{
 *   gold: number,
 *   capacity: number,
 *   capacityLevel: number,
 *   preserveLevel: number,
 *   speedLevel: number,
 *   cargoStacks: CargoStack[],
 *   nextStackId: number,
 *   quest: null | { from: string, to: string, goodId: string, qty: number, rewardGold: number, condition: number },
 *   locationId: string,
 *   unlocked: string[],
 *   unlockDeposits: Record<string, Record<string, number>>,
 *   travel: null | { from: string, to: string, elapsedMs: number, durationMs: number, distance: number, speed: number, traveledDistance: number },
 *   prices: Record<string, Record<string, number>>,
 *   visitedPrices: Record<string, Record<string, number>>,
 *   courier: null | CourierState,
 *   selectedLocId: string | null,
 *   nowMs: number,
 *   lastPriceDriftMs: number,
 *   tradeImpact: Record<string, { buys: { t: number, qty: number }[], sells: { t: number, qty: number }[] }>,
 *   playerName: string,
 *   chosenBodyId: string | null,
 *   openingDone: boolean,
 *   personal: Record<string, number>,
 *   warehouse: { area1: { stacks: CargoStack[] }, area2: { stacks: CargoStack[] } },
 *   universalCourierUnlocked: boolean,
 * }} GameState
 *
 * @typedef {{
 *   locationId: string,
 *   gold: number,
 *   capacity: number,
 *   cargoStacks: CargoStack[],
 *   route: string[],
 *   routeIndex: number,
 *   trade: Record<string, Record<string, { buy: boolean, sell: boolean }>>,
 *   travel: null | { from: string, to: string, elapsedMs: number, durationMs: number, distance: number, speed: number, traveledDistance: number, finalDest?: string },
 *   paused: boolean,
 * }} CourierState
 */

/** Round unit buy price to integer G. */
export function normalizeUnitPrice(p) {
  const n = Math.round(Number(p));
  return Number.isFinite(n) ? n : 0;
}

/** Allocate next stable stack id on game state (`stk_N`). */
export function allocStackId(s) {
  if (!s.nextStackId || s.nextStackId < 1) s.nextStackId = 1;
  const id = `stk_${s.nextStackId}`;
  s.nextStackId += 1;
  return id;
}

/** Total qty of goodId across stacks. */
export function stacksQtyOf(stacks, goodId) {
  let n = 0;
  for (const st of stacks || []) {
    if (st && st.goodId === goodId) n += Math.max(0, st.qty | 0);
  }
  return n;
}

/** Find stack by id. */
export function findStack(stacks, stackId) {
  if (!stackId) return null;
  return (stacks || []).find((st) => st && st.id === stackId) || null;
}

/**
 * Add qty into stacks — merge only when same goodId AND same unitPrice.
 * Condition blends within the matched stack only.
 * @param {CargoStack[]} stacks
 * @param {{ goodId: string, unitPrice: number, qty: number, condition?: number }} opts
 * @param {() => string} idGen
 */
export function addToStacks(stacks, opts, idGen) {
  const goodId = opts.goodId;
  const unitPrice = normalizeUnitPrice(opts.unitPrice);
  const qty = Math.floor(Number(opts.qty) || 0);
  if (!goodId || qty <= 0) return stacks;
  const condIn = opts.condition == null ? 100 : Math.max(0, Math.min(100, Number(opts.condition)));
  const existing = stacks.find(
    (st) => st && st.goodId === goodId && normalizeUnitPrice(st.unitPrice) === unitPrice,
  );
  if (existing) {
    const oldQ = existing.qty | 0;
    const oldC = existing.condition != null ? existing.condition : 100;
    existing.qty = oldQ + qty;
    existing.condition = oldQ + qty > 0 ? (oldC * oldQ + condIn * qty) / (oldQ + qty) : condIn;
    existing.unitPrice = unitPrice;
  } else {
    stacks.push({
      id: idGen(),
      goodId,
      unitPrice,
      qty,
      condition: condIn,
    });
  }
  return stacks;
}

/**
 * Remove qty from a specific stack. Returns removed chunk or null.
 * @returns {null | { goodId: string, unitPrice: number, qty: number, condition: number }}
 */
export function removeFromStack(stacks, stackId, qty) {
  const idx = (stacks || []).findIndex((st) => st && st.id === stackId);
  if (idx < 0) return null;
  const st = stacks[idx];
  qty = Math.floor(Number(qty) || 0);
  if (qty <= 0 || (st.qty | 0) < qty) return null;
  const out = {
    goodId: st.goodId,
    unitPrice: normalizeUnitPrice(st.unitPrice),
    qty,
    condition: st.condition != null ? st.condition : 100,
  };
  st.qty = (st.qty | 0) - qty;
  if (st.qty <= 0) stacks.splice(idx, 1);
  return out;
}

/**
 * Remove qty of goodId FIFO by stack array order (Slice AE unlock / sell-all).
 * @returns {{ removed: { goodId: string, unitPrice: number, qty: number, condition: number }[], taken: number }}
 */
export function removeFromStacksFifo(stacks, goodId, qty) {
  qty = Math.floor(Number(qty) || 0);
  /** @type {{ goodId: string, unitPrice: number, qty: number, condition: number }[]} */
  const removed = [];
  let left = qty;
  if (!(left > 0)) return { removed, taken: 0 };
  for (let i = 0; i < stacks.length && left > 0; ) {
    const st = stacks[i];
    if (!st || st.goodId !== goodId) {
      i += 1;
      continue;
    }
    const take = Math.min(st.qty | 0, left);
    if (take <= 0) {
      i += 1;
      continue;
    }
    removed.push({
      goodId: st.goodId,
      unitPrice: normalizeUnitPrice(st.unitPrice),
      qty: take,
      condition: st.condition != null ? st.condition : 100,
    });
    st.qty = (st.qty | 0) - take;
    left -= take;
    if (st.qty <= 0) stacks.splice(i, 1);
    else i += 1;
  }
  return { removed, taken: qty - left };
}

/**
 * Migrate legacy cargo map (+ optional buyMp avg / condition map) → stacks.
 * One stack per good with qty>0 at Math.round(buyMp.avg || 0).
 */
export function migrateCargoMapToStacks(cargo, buyMp, condition, idGen) {
  /** @type {CargoStack[]} */
  const stacks = [];
  if (!cargo || typeof cargo !== 'object') return stacks;
  for (const g of GOODS) {
    const qty = Math.floor(Number(cargo[g.id]) || 0);
    if (qty <= 0) continue;
    const unitPrice = Math.round(Number(buyMp?.[g.id]?.avg) || 0);
    const rawC = condition?.[g.id];
    const cond = rawC == null || !Number.isFinite(Number(rawC)) ? 100 : Math.max(0, Math.min(100, Number(rawC)));
    stacks.push({
      id: idGen(),
      goodId: g.id,
      unitPrice,
      qty,
      condition: cond,
    });
  }
  return stacks;
}

/** Normalize a persisted stack row. */
export function sanitizeStack(raw, idGen) {
  if (!raw || typeof raw !== 'object') return null;
  const goodId = typeof raw.goodId === 'string' ? raw.goodId : '';
  if (!GOODS.some((g) => g.id === goodId)) return null;
  const qty = Math.floor(Number(raw.qty) || 0);
  if (qty <= 0) return null;
  const unitPrice = normalizeUnitPrice(raw.unitPrice);
  const cond = raw.condition == null || !Number.isFinite(Number(raw.condition))
    ? 100
    : Math.max(0, Math.min(100, Number(raw.condition)));
  const id = typeof raw.id === 'string' && raw.id ? raw.id : idGen();
  return { id, goodId, unitPrice, qty, condition: cond };
}

/** @returns {GameState} */
export function createInitialState() {
  /** @type {Record<string, Record<string, number>>} */
  const prices = {};
  for (const loc of LOCATIONS) {
    prices[loc.id] = {};
    const base = BASE_PRICES[loc.id] || {};
    for (const g of GOODS) {
      if (base[g.id] != null) prices[loc.id][g.id] = base[g.id];
    }
  }

  /** @type {GameState} */
  const s = {
    gold: START_GOLD,
    capacityLevel: 0,
    capacity: effectiveCapacity(0),
    preserveLevel: 0,
    speedLevel: 0,
    cargoStacks: [],
    nextStackId: 1,
    quest: null,
    locationId: START_LOC,
    unlocked: [...INITIALLY_UNLOCKED],
    unlockDeposits: {},
    travel: null,
    prices,
    visitedPrices: {},
    courier: null,
    selectedLocId: START_LOC,
    nowMs: performance.now(),
    lastPriceDriftMs: 0,
    tradeImpact: {},
    playerName: 'Saikoro',
    chosenBodyId: null,
    openingDone: false,
    personal: {},
    warehouse: { area1: { stacks: [] }, area2: { stacks: [] } },
    universalCourierUnlocked: false,
  };
  const startRow = prices[START_LOC] || {};
  const startSnap = {};
  for (const g of GOODS) {
    const p = startRow[g.id];
    if (p != null && Number.isFinite(p)) startSnap[g.id] = Math.round(p);
  }
  s.visitedPrices[START_LOC] = startSnap;
  return s;
}

/** Weighted avg buy unit price across stacks of goodId (null if none). */
export function effectiveBuyAvg(s, goodId) {
  let sum = 0;
  let qty = 0;
  for (const st of s.cargoStacks || []) {
    if (!st || st.goodId !== goodId) continue;
    const q = st.qty | 0;
    if (q <= 0) continue;
    sum += normalizeUnitPrice(st.unitPrice) * q;
    qty += q;
  }
  if (qty <= 0) return null;
  return sum / qty;
}

/** No-op kept for leave-station call sites (buy commits into stacks immediately). */
export function commitStationBuys(_s) {
  /* Slice AE: unitPrice lands on stacks at buy time; nothing to fold. */
}

/** Total cargo weight in grams. @param {GameState} s */
export function cargoUsed(s) {
  let grams = 0;
  for (const st of s.cargoStacks || []) {
    if (!st) continue;
    const n = st.qty | 0;
    if (n) grams += n * (goodWeightG(st.goodId) || 0);
  }
  if (s.quest && s.quest.qty > 0) {
    grams += s.quest.qty * (goodWeightG(s.quest.goodId) || 0);
  }
  return grams;
}

/** Courier cargo weight (no quest lot). @param {CourierState} c */
export function courierCargoUsed(c) {
  if (!c) return 0;
  let grams = 0;
  for (const st of c.cargoStacks || []) {
    if (!st) continue;
    const n = st.qty | 0;
    if (n) grams += n * (goodWeightG(st.goodId) || 0);
  }
  return grams;
}

/** Empty stacks for a new courier. */
export function emptyStacks() {
  return [];
}

/** @deprecated Slice AE — use emptyStacks(); kept for migration imports. */
export function emptyCargoMap() {
  /** @type {Record<string, number>} */
  const cargo = {};
  for (const g of GOODS) cargo[g.id] = 0;
  return cargo;
}

/** @param {GameState} s */
export function isTraveling(s) {
  return s.travel != null;
}

/** Player + courier both docked at same station. */
export function courierCoLocated(s) {
  const c = s.courier;
  if (!c) return false;
  if (s.travel || c.travel) return false;
  return c.locationId === s.locationId;
}

/** Weighted condition % across stacks of goodId (0 if none). */
export function goodCondition(s, goodId) {
  let sum = 0;
  let qty = 0;
  for (const st of s.cargoStacks || []) {
    if (!st || st.goodId !== goodId) continue;
    const q = st.qty | 0;
    if (q <= 0) continue;
    const c = st.condition != null ? st.condition : 100;
    sum += c * q;
    qty += q;
  }
  if (qty <= 0) return 0;
  return Math.max(0, Math.min(100, sum / qty));
}

/** Courier weighted condition % for a good. */
export function courierGoodCondition(c, goodId) {
  if (!c) return 0;
  let sum = 0;
  let qty = 0;
  for (const st of c.cargoStacks || []) {
    if (!st || st.goodId !== goodId) continue;
    const q = st.qty | 0;
    if (q <= 0) continue;
    const v = st.condition != null ? st.condition : 100;
    sum += v * q;
    qty += q;
  }
  if (qty <= 0) return 0;
  return Math.max(0, Math.min(100, sum / qty));
}

/** Copy live MP for loc into visitedPrices (Slice P). */
export function snapshotVisitedPrices(s, locId) {
  if (!locId || !s.prices?.[locId]) return;
  if (!s.visitedPrices) s.visitedPrices = {};
  const row = s.prices[locId];
  const snap = {};
  for (const g of GOODS) {
    const p = row[g.id];
    if (p != null && Number.isFinite(p)) snap[g.id] = Math.round(p);
  }
  s.visitedPrices[locId] = snap;
}

/** Default courier capacity constant re-export helper. */
export function defaultCourierCapacity() {
  return COURIER_CAPACITY;
}

/** Map hub loc → warehouse area key. @returns {'area1'|'area2'|null} */
export function warehouseKeyForLoc(locId) {
  if (locId === AREA1_WAREHOUSE_LOC) return 'area1';
  if (locId === AREA2_WAREHOUSE_LOC) return 'area2';
  return null;
}

/** Active warehouse key from player dock (or null). */
export function warehouseKeyAtPlayer(s) {
  if (s.travel) return null;
  return warehouseKeyForLoc(s.locationId);
}

/**
 * Ensure warehouse bags exist (area1 + area2 stacks).
 * @param {GameState} s
 * @param {'area1'|'area2'|null} [key] bag to return; default area1, or current hub if docked.
 */
export function ensureWarehouse(s, key = null) {
  if (!s.warehouse) s.warehouse = { area1: { stacks: [] }, area2: { stacks: [] } };
  if (!s.warehouse.area1) s.warehouse.area1 = { stacks: [] };
  if (!Array.isArray(s.warehouse.area1.stacks)) s.warehouse.area1.stacks = [];
  if (!s.warehouse.area2) s.warehouse.area2 = { stacks: [] };
  if (!Array.isArray(s.warehouse.area2.stacks)) s.warehouse.area2.stacks = [];
  const k = key || warehouseKeyAtPlayer(s) || 'area1';
  return s.warehouse[k] || s.warehouse.area1;
}

/** Total warehouse mass in grams for a bag. @param {GameState} s @param {'area1'|'area2'|null} [key] */
export function warehouseUsed(s, key = null) {
  const wh = ensureWarehouse(s, key);
  if (!wh?.stacks) return 0;
  let grams = 0;
  for (const st of wh.stacks) {
    if (!st) continue;
    const n = st.qty | 0;
    if (n) grams += n * (goodWeightG(st.goodId) || 0);
  }
  return grams;
}

/** Warehouse weighted condition % for a good (100 if unset). */
export function warehouseGoodCondition(s, goodId, key = null) {
  const wh = ensureWarehouse(s, key);
  if (!wh?.stacks) return 0;
  let sum = 0;
  let qty = 0;
  for (const st of wh.stacks) {
    if (!st || st.goodId !== goodId) continue;
    const q = st.qty | 0;
    if (q <= 0) continue;
    const v = st.condition != null ? st.condition : 100;
    sum += v * q;
    qty += q;
  }
  if (qty <= 0) return 0;
  return Math.max(0, Math.min(100, sum / qty));
}

/** Player docked at any area warehouse hub (Broken Lamp or Mist Spur). */
export function playerAtWarehouse(s) {
  return !s.travel && warehouseKeyForLoc(s.locationId) != null;
}

/** Courier docked at the same warehouse hub as the player (or any hub if player not at one). */
export function courierAtWarehouse(s) {
  const c = s.courier;
  if (!c || c.travel) return false;
  const playerKey = warehouseKeyAtPlayer(s);
  const courierKey = warehouseKeyForLoc(c.locationId);
  if (!courierKey) return false;
  // Prefer same hub as player when both at warehouses
  if (playerKey) return courierKey === playerKey;
  return true;
}
