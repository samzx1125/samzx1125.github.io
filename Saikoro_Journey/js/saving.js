/** localStorage save/load — SAVE_VERSION bump requires migration. */
export const SAVE_VERSION = 2;
const KEY = 'saikoro_journey_z1_v2';

/** @type {number | null} */
let lastSavedAt = null;

export function getLastSavedAt() {
  return lastSavedAt;
}

/**
 * @param {import('./state.js').GameState} s
 */
export function serialize(s) {
  return {
    v: SAVE_VERSION,
    gold: s.gold,
    cargo: { ...s.cargo },
    locationId: s.locationId,
    unlocked: [...s.unlocked],
    buyMp: s.buyMp ? { ...Object.fromEntries(Object.entries(s.buyMp).map(([k, v]) => [k, { ...v }])) } : {},
    prices: s.prices
      ? Object.fromEntries(
          Object.entries(s.prices).map(([loc, row]) => [loc, { ...row }]),
        )
      : {},
    savedAt: Date.now(),
    // stationBuys not persisted — mid-visit buffer
  };
}

/**
 * @param {import('./state.js').GameState} s
 * @param {any} data
 */
export function applySave(s, data) {
  if (!data || data.v !== SAVE_VERSION) return false;
  s.gold = data.gold;
  s.cargo = { ...data.cargo };
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
    const raw = localStorage.getItem(KEY);
    if (!raw) return false;
    return applySave(s, JSON.parse(raw));
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
    lastSavedAt = null;
  } catch {
    /* ignore */
  }
}
