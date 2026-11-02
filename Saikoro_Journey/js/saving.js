/** localStorage save/load — SAVE_VERSION bump requires migration. */
import { GOODS, effectiveCapacity } from './economy-data.js?v=z1-20261028ah';
import { emptyCargoMap } from './state.js?v=z1-20261028ah';

export const SAVE_VERSION = 6;
const KEY = 'saikoro_journey_z1_v6';
const KEY_V5 = 'saikoro_journey_z1_v5';
const KEY_V4 = 'saikoro_journey_z1_v4';
const KEY_V3 = 'saikoro_journey_z1_v3';
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
  // Accept v2–v6 (v6 = personal inventory)
  if (!data || (data.v !== 2 && data.v !== 3 && data.v !== 4 && data.v !== 5 && data.v !== 6 && data.v !== SAVE_VERSION)) return false;
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
  // Slice T+/U — multi-trip unlock deposits (v5+); drop buckets for already-unlocked targets
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
  // capacityLevel 0..5; recompute capacity from level
  {
    let lv = data.v >= 5 ? Math.floor(Number(data.capacityLevel)) : 0;
    if (!Number.isFinite(lv) || lv < 0) lv = 0;
    if (lv > 5) lv = 5;
    s.capacityLevel = lv;
    s.capacity = effectiveCapacity(lv);
  }
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
  // Slice S — opening identity
  // v2/v3 existing saves: skip opening (openingDone=true) with defaults
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
  // Slice U — personal / key inventory (v6+); older → {}
  s.personal = {};
  if (data.v >= 6 && data.personal && typeof data.personal === 'object') {
    for (const id of Object.keys(data.personal)) {
      if (typeof id !== 'string' || !id) continue;
      const n = Math.floor(Number(data.personal[id]));
      if (Number.isFinite(n) && n > 0) s.personal[id] = n;
    }
  }
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
      // migrate v5 → v6
      raw = localStorage.getItem(KEY_V5);
    }
    if (!raw) {
      // migrate v4 → v6
      raw = localStorage.getItem(KEY_V4);
    }
    if (!raw) {
      // migrate v3 → v6
      raw = localStorage.getItem(KEY_V3);
    }
    if (!raw) {
      // migrate v2 → v6
      raw = localStorage.getItem(KEY_V2);
    }
    if (!raw) return false;
    const ok = applySave(s, JSON.parse(raw));
    // rewrite into current key once loaded from older key
    if (ok) {
      try { localStorage.setItem(KEY, JSON.stringify(serialize(s))); } catch { /* ignore */ }
    }
    return ok;
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(KEY_V5);
    localStorage.removeItem(KEY_V4);
    localStorage.removeItem(KEY_V3);
    localStorage.removeItem(KEY_V2);
    lastSavedAt = null;
  } catch {
    /* ignore */
  }
}
