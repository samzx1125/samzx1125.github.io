/** localStorage save/load — SAVE_VERSION bump requires migration. */
import { GOODS, effectiveCapacity } from './economy-data.js?v=z1-20261028cq';
import {
  migrateCargoMapToStacks,
  sanitizeStack,
  emptyCargoMap,
} from './state.js?v=z1-20261028cq';

export const SAVE_VERSION = 12;
const KEY = 'saikoro_journey_z1_v12';
const KEY_V11 = 'saikoro_journey_z1_v11';
const KEY_V10 = 'saikoro_journey_z1_v10';
const KEY_V9 = 'saikoro_journey_z1_v9';
const KEY_V8 = 'saikoro_journey_z1_v8';
const KEY_V7 = 'saikoro_journey_z1_v7';
const KEY_V6 = 'saikoro_journey_z1_v6';
const KEY_V5 = 'saikoro_journey_z1_v5';
const KEY_V4 = 'saikoro_journey_z1_v4';
const KEY_V3 = 'saikoro_journey_z1_v3';
const KEY_V2 = 'saikoro_journey_z1_v2';

/** @type {number | null} */
let lastSavedAt = null;

export function getLastSavedAt() {
  return lastSavedAt;
}

function serializeStacks(stacks) {
  if (!Array.isArray(stacks)) return [];
  return stacks
    .map((st) => {
      if (!st || typeof st !== 'object') return null;
      const qty = Math.floor(Number(st.qty) || 0);
      if (qty <= 0) return null;
      if (!GOODS.some((g) => g.id === st.goodId)) return null;
      return {
        id: String(st.id || ''),
        goodId: st.goodId,
        unitPrice: Math.round(Number(st.unitPrice) || 0),
        qty,
        condition: Math.max(0, Math.min(100, Number(st.condition) || 100)),
      };
    })
    .filter(Boolean);
}

function serializeCourier(c) {
  if (!c) return null;
  return {
    locationId: c.locationId,
    gold: c.gold,
    capacity: c.capacity,
    cargoStacks: serializeStacks(c.cargoStacks),
    route: [...c.route],
    routeIndex: c.routeIndex | 0,
    trade: c.trade
      ? Object.fromEntries(
          Object.entries(c.trade).map(([loc, row]) => [
            loc,
            Object.fromEntries(
              Object.entries(row).map(([g, flags]) => [g, { buy: !!flags.buy, sell: !!flags.sell }]),
            ),
          ]),
        )
      : {},
    paused: !!c.paused,
    // travel not persisted — resume from docked location
  };
}

/**
 * @param {import('./state.js').GameState} s
 */
export function serialize(s) {
  return {
    v: SAVE_VERSION,
    gold: s.gold,
    cargoStacks: serializeStacks(s.cargoStacks),
    nextStackId: Math.max(1, s.nextStackId | 0),
    quest: s.quest ? { ...s.quest } : null,
    locationId: s.locationId,
    unlocked: [...s.unlocked],
    unlockDeposits: s.unlockDeposits
      ? Object.fromEntries(
          Object.entries(s.unlockDeposits).map(([tid, row]) => [
            tid,
            Object.fromEntries(
              Object.entries(row || {})
                .map(([gid, n]) => [gid, Math.max(0, Math.floor(Number(n) || 0))])
                .filter(([, n]) => n > 0),
            ),
          ]).filter(([, row]) => Object.keys(row).length > 0),
        )
      : {},
    capacityLevel: Math.max(0, Math.min(5, s.capacityLevel | 0)),
    preserveLevel: Math.max(0, Math.min(5, s.preserveLevel | 0)),
    speedLevel: Math.max(0, Math.min(5, s.speedLevel | 0)),
    prices: s.prices
      ? Object.fromEntries(
          Object.entries(s.prices).map(([loc, row]) => [loc, { ...row }]),
        )
      : {},
    visitedPrices: s.visitedPrices
      ? Object.fromEntries(
          Object.entries(s.visitedPrices).map(([loc, row]) => [loc, { ...row }]),
        )
      : {},
    courier: serializeCourier(s.courier),
    playerName: typeof s.playerName === 'string' && s.playerName.trim() ? s.playerName.trim().slice(0, 24) : 'Saikoro',
    chosenBodyId: s.chosenBodyId || 'body_a',
    openingDone: !!s.openingDone,
    personal: s.personal && typeof s.personal === 'object'
      ? Object.fromEntries(
          Object.entries(s.personal)
            .map(([id, n]) => [id, Math.max(0, Math.floor(Number(n) || 0))])
            .filter(([, n]) => n > 0),
        )
      : {},
    warehouse: {
      area1: {
        stacks: serializeStacks(s.warehouse?.area1?.stacks),
      },
      area2: {
        stacks: serializeStacks(s.warehouse?.area2?.stacks),
      },
    },
    universalCourierUnlocked: !!s.universalCourierUnlocked,
    savedAt: Date.now(),
  };
}

function makeIdGen(startRef) {
  return () => {
    const id = `stk_${startRef.n}`;
    startRef.n += 1;
    return id;
  };
}

function applyCourier(dataCourier, idGen) {
  if (!dataCourier || typeof dataCourier !== 'object') return null;

  /** @type {import('./state.js').CargoStack[]} */
  let cargoStacks = [];
  if (Array.isArray(dataCourier.cargoStacks)) {
    for (const raw of dataCourier.cargoStacks) {
      const st = sanitizeStack(raw, idGen);
      if (st) cargoStacks.push(st);
    }
  } else if (dataCourier.cargo && typeof dataCourier.cargo === 'object') {
    // v≤10 courier: cargo map + condition, no buy price → unitPrice 0
    cargoStacks = migrateCargoMapToStacks(
      dataCourier.cargo,
      {},
      dataCourier.condition && typeof dataCourier.condition === 'object' ? dataCourier.condition : {},
      idGen,
    );
  }

  const route = Array.isArray(dataCourier.route)
    ? dataCourier.route.filter((id) => typeof id === 'string')
    : [];
  /** @type {Record<string, Record<string, { buy: boolean, sell: boolean }>>} */
  const trade = {};
  if (dataCourier.trade && typeof dataCourier.trade === 'object') {
    for (const locId of Object.keys(dataCourier.trade)) {
      const row = dataCourier.trade[locId];
      if (!row || typeof row !== 'object') continue;
      trade[locId] = {};
      for (const g of GOODS) {
        const flags = row[g.id];
        trade[locId][g.id] = {
          buy: !!(flags && flags.buy),
          sell: !!(flags && flags.sell),
        };
      }
    }
  }
  return {
    locationId: String(dataCourier.locationId || ''),
    gold: Math.max(0, Math.floor(Number(dataCourier.gold) || 0)),
    capacity: Math.max(1, Math.floor(Number(dataCourier.capacity) || 3000)),
    cargoStacks,
    route,
    routeIndex: Math.max(0, Math.floor(Number(dataCourier.routeIndex) || 0)),
    trade,
    travel: null,
    paused: !!dataCourier.paused,
  };
}

/**
 * @param {import('./state.js').GameState} s
 * @param {any} data
 */
export function applySave(s, data) {
  // Accept v2–v12 (v11 = price-split stacks; v12 = Area2 warehouse)
  if (
    !data ||
    (data.v !== 2 &&
      data.v !== 3 &&
      data.v !== 4 &&
      data.v !== 5 &&
      data.v !== 6 &&
      data.v !== 7 &&
      data.v !== 8 &&
      data.v !== 9 &&
      data.v !== 10 &&
      data.v !== 11 &&
      data.v !== 12 &&
      data.v !== SAVE_VERSION)
  ) {
    return false;
  }
  s.gold = data.gold;

  const idRef = { n: Math.max(1, Math.floor(Number(data.nextStackId) || 1)) };
  const idGen = makeIdGen(idRef);

  // Slice AE — cargoStacks (v11) or migrate cargo+buyMp+condition (v≤10)
  if (data.v >= 11 && Array.isArray(data.cargoStacks)) {
    s.cargoStacks = [];
    for (const raw of data.cargoStacks) {
      const st = sanitizeStack(raw, idGen);
      if (st) s.cargoStacks.push(st);
    }
  } else {
    const cargo = data.cargo && typeof data.cargo === 'object' ? data.cargo : emptyCargoMap();
    const buyMp = data.buyMp && typeof data.buyMp === 'object' ? data.buyMp : {};
    const condition = data.condition && typeof data.condition === 'object' ? data.condition : {};
    s.cargoStacks = migrateCargoMapToStacks(cargo, buyMp, condition, idGen);
  }

  s.quest =
    data.quest && typeof data.quest === 'object'
      ? {
          from: data.quest.from,
          to: data.quest.to,
          goodId: data.quest.goodId,
          qty: data.quest.qty,
          rewardGold: data.quest.rewardGold,
          condition: data.quest.condition != null ? data.quest.condition : 100,
        }
      : null;
  s.locationId = data.locationId;
  s.unlocked = [...data.unlocked];
  s.unlockDeposits = {};
  if (data.v >= 5 && data.unlockDeposits && typeof data.unlockDeposits === 'object') {
    const unlockedSet = new Set(s.unlocked);
    for (const tid of Object.keys(data.unlockDeposits)) {
      if (unlockedSet.has(tid)) continue;
      const row = data.unlockDeposits[tid];
      if (!row || typeof row !== 'object') continue;
      const out = {};
      for (const gid of Object.keys(row)) {
        const n = Math.floor(Number(row[gid]));
        if (Number.isFinite(n) && n > 0) out[gid] = n;
      }
      if (Object.keys(out).length) s.unlockDeposits[tid] = out;
    }
  }
  {
    let lv = data.v >= 5 ? Math.floor(Number(data.capacityLevel)) : 0;
    if (!Number.isFinite(lv) || lv < 0) lv = 0;
    if (lv > 5) lv = 5;
    s.capacityLevel = lv;
    s.capacity = effectiveCapacity(lv);
  }
  {
    let pl = data.v >= 7 ? Math.floor(Number(data.preserveLevel)) : 0;
    if (!Number.isFinite(pl) || pl < 0) pl = 0;
    if (pl > 5) pl = 5;
    s.preserveLevel = pl;
  }
  {
    let sl = data.v >= 8 ? Math.floor(Number(data.speedLevel)) : 0;
    if (!Number.isFinite(sl) || sl < 0) sl = 0;
    if (sl > 5) sl = 5;
    s.speedLevel = sl;
  }
  s.selectedLocId = data.locationId;
  s.travel = null;
  if (data.prices && typeof data.prices === 'object') {
    for (const locId of Object.keys(data.prices)) {
      if (!s.prices[locId]) s.prices[locId] = {};
      const row = data.prices[locId];
      if (!row || typeof row !== 'object') continue;
      for (const goodId of Object.keys(row)) {
        const n = Number(row[goodId]);
        if (Number.isFinite(n) && n > 0) s.prices[locId][goodId] = Math.round(n);
      }
    }
  }
  s.visitedPrices = {};
  if (data.visitedPrices && typeof data.visitedPrices === 'object') {
    for (const locId of Object.keys(data.visitedPrices)) {
      const row = data.visitedPrices[locId];
      if (!row || typeof row !== 'object') continue;
      s.visitedPrices[locId] = {};
      for (const goodId of Object.keys(row)) {
        const n = Number(row[goodId]);
        if (Number.isFinite(n) && n > 0) s.visitedPrices[locId][goodId] = Math.round(n);
      }
    }
  }
  if (s.locationId && s.prices?.[s.locationId]) {
    if (!s.visitedPrices[s.locationId]) {
      const snap = {};
      for (const goodId of Object.keys(s.prices[s.locationId])) {
        const n = Number(s.prices[s.locationId][goodId]);
        if (Number.isFinite(n) && n > 0) snap[goodId] = Math.round(n);
      }
      s.visitedPrices[s.locationId] = snap;
    }
  }
  s.courier = data.v >= 3 ? applyCourier(data.courier, idGen) : null;
  s.lastPriceDriftMs = 0;
  s.tradeImpact = {};
  if (data.v >= 4) {
    const nm = typeof data.playerName === 'string' ? data.playerName.trim().slice(0, 24) : '';
    s.playerName = nm || 'Saikoro';
    const bid = typeof data.chosenBodyId === 'string' ? data.chosenBodyId : 'body_a';
    s.chosenBodyId = ['body_a', 'body_b', 'body_c', 'body_d'].includes(bid) ? bid : 'body_a';
    s.openingDone = !!data.openingDone;
  } else {
    s.playerName = 'Saikoro';
    s.chosenBodyId = 'body_a';
    s.openingDone = true;
  }
  s.personal = {};
  if (data.v >= 6 && data.personal && typeof data.personal === 'object') {
    for (const id of Object.keys(data.personal)) {
      if (typeof id !== 'string' || !id) continue;
      const n = Math.floor(Number(data.personal[id]));
      if (Number.isFinite(n) && n > 0) s.personal[id] = n;
    }
  }
  // Slice AB/AE/AG — warehouse stacks (area1 + area2)
  s.warehouse = { area1: { stacks: [] }, area2: { stacks: [] } };
  if (data.v >= 11 && data.warehouse?.area1 && typeof data.warehouse.area1 === 'object') {
    const src = data.warehouse.area1;
    if (Array.isArray(src.stacks)) {
      for (const raw of src.stacks) {
        const st = sanitizeStack(raw, idGen);
        if (st) s.warehouse.area1.stacks.push(st);
      }
    }
  } else if (data.v >= 9 && data.warehouse?.area1 && typeof data.warehouse.area1 === 'object') {
    const src = data.warehouse.area1;
    // migrate cargo/condition maps → unitPrice 0 stacks
    s.warehouse.area1.stacks = migrateCargoMapToStacks(
      src.cargo && typeof src.cargo === 'object' ? src.cargo : {},
      {},
      src.condition && typeof src.condition === 'object' ? src.condition : {},
      idGen,
    );
  }
  // Slice AG — area2 stacks (empty on migrate from ≤11)
  if (data.v >= 12 && data.warehouse?.area2 && typeof data.warehouse.area2 === 'object') {
    const src2 = data.warehouse.area2;
    if (Array.isArray(src2.stacks)) {
      for (const raw of src2.stacks) {
        const st = sanitizeStack(raw, idGen);
        if (st) s.warehouse.area2.stacks.push(st);
      }
    }
  }
  {
    const SCRAP_GATE = 'loc_a01z03l003_scrap_gate';
    if (data.v >= 10 && typeof data.universalCourierUnlocked === 'boolean') {
      s.universalCourierUnlocked = data.universalCourierUnlocked;
    } else {
      s.universalCourierUnlocked = s.unlocked.includes(SCRAP_GATE);
    }
  }

  // bump nextStackId past any loaded ids
  let maxN = idRef.n;
  const scan = (stacks) => {
    for (const st of stacks || []) {
      const m = typeof st?.id === 'string' && /^stk_(\d+)$/.exec(st.id);
      if (m) maxN = Math.max(maxN, Number(m[1]) + 1);
    }
  };
  scan(s.cargoStacks);
  scan(s.warehouse.area1.stacks);
  scan(s.warehouse.area2?.stacks);
  if (s.courier) scan(s.courier.cargoStacks);
  s.nextStackId = Math.max(1, maxN);

  lastSavedAt = typeof data.savedAt === 'number' ? data.savedAt : Date.now();
  return true;
}

/** @param {import('./state.js').GameState} s */
export function saveGame(s) {
  try {
    const payload = serialize(s);
    localStorage.setItem(KEY, JSON.stringify(payload));
    lastSavedAt = payload.savedAt;
    return true;
  } catch {
    return false;
  }
}

/** @param {import('./state.js').GameState} s */
export function loadGame(s) {
  try {
    let raw = localStorage.getItem(KEY);
    if (!raw) raw = localStorage.getItem(KEY_V11);
    if (!raw) raw = localStorage.getItem(KEY_V10);
    if (!raw) raw = localStorage.getItem(KEY_V9);
    if (!raw) raw = localStorage.getItem(KEY_V8);
    if (!raw) raw = localStorage.getItem(KEY_V7);
    if (!raw) raw = localStorage.getItem(KEY_V6);
    if (!raw) raw = localStorage.getItem(KEY_V5);
    if (!raw) raw = localStorage.getItem(KEY_V4);
    if (!raw) raw = localStorage.getItem(KEY_V3);
    if (!raw) raw = localStorage.getItem(KEY_V2);
    if (!raw) return false;
    const ok = applySave(s, JSON.parse(raw));
    if (ok) {
      try {
        localStorage.setItem(KEY, JSON.stringify(serialize(s)));
      } catch {
        /* ignore */
      }
    }
    return ok;
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(KEY_V11);
    localStorage.removeItem(KEY_V10);
    localStorage.removeItem(KEY_V9);
    localStorage.removeItem(KEY_V8);
    localStorage.removeItem(KEY_V7);
    localStorage.removeItem(KEY_V6);
    localStorage.removeItem(KEY_V5);
    localStorage.removeItem(KEY_V4);
    localStorage.removeItem(KEY_V3);
    localStorage.removeItem(KEY_V2);
    lastSavedAt = null;
  } catch {
    /* ignore */
  }
}
