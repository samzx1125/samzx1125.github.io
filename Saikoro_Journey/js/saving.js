/** localStorage save/load — SAVE_VERSION bump requires migration. */
export const SAVE_VERSION = 1;
const KEY = 'saikoro_journey_z1_v1';

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
    // prices are static — reload from BASE_PRICES on load
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
  return true;
}

/** @param {import('./state.js').GameState} s */
export function saveGame(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(serialize(s)));
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
  } catch {
    /* ignore */
  }
}
