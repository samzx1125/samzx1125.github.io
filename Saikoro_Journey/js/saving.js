/** localStorage save/load — SAVE_VERSION bump requires migration. */
import { GOODS } from './economy-data.js?v=z1-20261028ac';
import { emptyCargoMap } from './state.js?v=z1-20261028ac';

export const SAVE_VERSION = 3;
const KEY = 'saikoro_journey_z1_v3';
const KEY_V2 = 'saikoro_journey_z1_v2';

/** @type {number | null} */
let lastSavedAt = null;

export function getLastSavedAt() {
  return lastSavedAt;
}

function serializeCourier(c) {
  if (!c) return null;
  return {
    locationId: c.locationId,
    gold: c.gold,
    capacity: c.capacity,
    cargo: { ...c.cargo },
    condition: c.condition ? { ...c.condition } : {},
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
    cargo: { ...s.cargo },
    condition: s.condition ? { ...s.condition } : {},
    quest: s.quest ? { ...s.quest } : null,
    locationId: s.locationId,
    unlocked: [...s.unlocked],
    buyMp: s.buyMp ? { ...Object.fromEntries(Object.entries(s.buyMp).map(([k, v]) => [k, { ...v }])) } : {},
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
    savedAt: Date.now(),
    // stationBuys not persisted — mid-visit buffer
  };
}

function applyCourier(dataCourier) {
  if (!dataCourier || typeof dataCourier !== 'object') return null;
  const cargo = emptyCargoMap();
  if (dataCourier.cargo && typeof dataCourier.cargo === 'object') {
    for (const g of GOODS) {
      const n = Number(dataCourier.cargo[g.id]);
      if (Number.isFinite(n) && n > 0) cargo[g.id] = Math.floor(n);
    }
  }
  const condition = {};
  if (dataCourier.condition && typeof dataCourier.condition === 'object') {
    for (const g of GOODS) {
      const n = Number(dataCourier.condition[g.id]);
      if (Number.isFinite(n)) condition[g.id] = Math.max(0, Math.min(100, n));
    }
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
    cargo,
    condition,
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
  // Accept v2 (no courier) and v3 (with courier)
  if (!data || (data.v !== 2 && data.v !== 3 && data.v !== SAVE_VERSION)) return false;
  s.gold = data.gold;
  s.cargo = { ...data.cargo };
  s.condition = data.condition && typeof data.condition === 'object' ? { ...data.condition } : {};
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
  s.selectedLocId = data.locationId;
  s.travel = null;
  s.buyMp = data.buyMp && typeof data.buyMp === 'object' ? { ...data.buyMp } : {};
  s.stationBuys = {};
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
  // ensure current station has a memory snapshot
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
  // Slice Q — courier (null on v2 / missing)
  s.courier = data.v >= 3 ? applyCourier(data.courier) : null;
  s.lastPriceDriftMs = 0;
  s.tradeImpact = {};
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
    if (!raw) {
      // migrate v2 → v3 (courier null)
      raw = localStorage.getItem(KEY_V2);
    }
    if (!raw) return false;
    return applySave(s, JSON.parse(raw));
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(KEY_V2);
    lastSavedAt = null;
  } catch {
    /* ignore */
  }
}
