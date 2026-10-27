import { BASE_PRICES, DRIFT_INTERVAL_MS, DRIFT_MAX_PCT, IMPACT_WINDOW_MS, BUY_IMPACT_THRESHOLD, SELL_IMPACT_THRESHOLD, BUY_IMPACT_CAP, SELL_IMPACT_CAP, IMPACT_DECAY_PER_SEC, GOODS } from './economy-data.js';
import { LOCATIONS } from './map-data.js';
import { cargoUsed } from './state.js';

/**
 * Apply market price = base * (1 + buyPush - sellPush), clamped by caps already in push.
 * @param {import('./state.js').GameState} s
 * @param {string} locId
 * @param {string} goodId
 */
export function refreshDisplayedPrice(s, locId, goodId) {
  const base = BASE_PRICES[locId]?.[goodId];
  if (base == null) return;
  const imp = s.impact[locId][goodId];
  const mult = 1 + imp.buyPush - imp.sellPush;
  s.prices[locId][goodId] = Math.max(1, Math.round(base * mult));
}

/**
 * @param {import('./state.js').GameState} s
 * @param {number} dtMs
 */
function decayImpact(s, dtMs) {
  const decay = IMPACT_DECAY_PER_SEC * (dtMs / 1000);
  for (const loc of LOCATIONS) {
    for (const g of GOODS) {
      const imp = s.impact[loc.id]?.[g.id];
      if (!imp) continue;
      if (imp.buyPush > 0) {
        imp.buyPush = Math.max(0, imp.buyPush * Math.exp(-decay * 3));
        if (imp.buyPush < 0.001) imp.buyPush = 0;
      }
      if (imp.sellPush > 0) {
        imp.sellPush = Math.max(0, imp.sellPush * Math.exp(-decay * 3));
        if (imp.sellPush < 0.001) imp.sellPush = 0;
      }
      refreshDisplayedPrice(s, loc.id, g.id);
    }
  }
}

/**
 * Slow drift ±0–2% every ~5s on each (loc, good).
 * @param {import('./state.js').GameState} s
 */
function maybeDrift(s) {
  if (s.nowMs - s.lastDriftMs < DRIFT_INTERVAL_MS) return;
  s.lastDriftMs = s.nowMs;
  for (const loc of LOCATIONS) {
    for (const g of GOODS) {
      if (BASE_PRICES[loc.id]?.[g.id] == null) continue;
      const base = BASE_PRICES[loc.id][g.id];
      const imp = s.impact[loc.id][g.id];
      // Drift the effective base via nudging buy/sell push slightly... better: nudge current price relative to base while preserving impact
      // Spec: drift each (loc,good) ±0–2%. Apply as small random walk on a "drift factor" baked into price relative to (base * impact).
      // Simplest v0: adjust buyPush/sellPush is wrong. Instead store drift on price directly then re-apply impact from base+drift.
      // Use prices as displayed; drift modifies an underlying factor by storing residual in buyPush? Cleaner: keep a driftPct field.
      // Minimal: randomly walk displayed price by ±0–2% of current, then clamp relative to base within impact caps + drift band.
      const pct = (Math.random() * 2 - 1) * DRIFT_MAX_PCT; // -2%..+2%
      const cur = s.prices[loc.id][g.id];
      let next = Math.max(1, Math.round(cur * (1 + pct)));
      const minP = Math.round(base * (1 - SELL_IMPACT_CAP - 0.1));
      const maxP = Math.round(base * (1 + BUY_IMPACT_CAP + 0.1));
      next = Math.min(maxP, Math.max(minP, next));
      s.prices[loc.id][g.id] = next;
      // Reconcile push so impact model stays coherent: set push from deviation
      const ratio = next / base - 1;
      if (ratio >= 0) {
        imp.buyPush = Math.min(BUY_IMPACT_CAP, ratio);
        imp.sellPush = 0;
      } else {
        imp.sellPush = Math.min(SELL_IMPACT_CAP, -ratio);
        imp.buyPush = 0;
      }
    }
  }
}

/**
 * @param {import('./state.js').GameState} s
 * @param {number} nowMs
 */
export function tick(s, nowMs) {
  const rawDt = Math.max(0, nowMs - s.nowMs);
  s.nowMs = nowMs;

  if (s.travel) {
    s.travel.elapsedMs += rawDt;
    if (s.travel.elapsedMs >= s.travel.durationMs) {
      s.locationId = s.travel.to;
      s.selectedLocId = s.travel.to;
      s.travel = null;
    }
  }

  // Prices static this slice (user): no drift / impact tick.
  // decayImpact / maybeDrift kept dormant for a later trade UI slice.
}

/**
 * @param {import('./state.js').GameState} s
 * @param {string} locId
 * @param {string} goodId
 * @param {number} qty
 * @returns {{ ok: boolean, reason?: string }}
 */
export function tryBuy(s, locId, goodId, qty) {
  if (s.travel) return { ok: false, reason: 'traveling' };
  if (s.locationId !== locId) return { ok: false, reason: 'not_here' };
  if (!s.unlocked.includes(locId)) return { ok: false, reason: 'locked' };
  const price = s.prices[locId]?.[goodId];
  if (price == null) return { ok: false, reason: 'no_quote' };
  qty = Math.floor(qty);
  if (qty <= 0) return { ok: false, reason: 'qty' };
  const cost = price * qty;
  if (s.gold < cost) return { ok: false, reason: 'gold' };
  if (cargoUsed(s) + qty > s.capacity) return { ok: false, reason: 'capacity' };

  s.gold -= cost;
  s.cargo[goodId] = (s.cargo[goodId] || 0) + qty;
  applyBuyImpact(s, locId, goodId, qty);
  return { ok: true };
}

/**
 * @param {import('./state.js').GameState} s
 * @param {string} locId
 * @param {string} goodId
 * @param {number} qty
 */
function applyBuyImpact(s, locId, goodId, qty) {
  const imp = s.impact[locId][goodId];
  const now = s.nowMs;
  if (now - imp.buyWindowStart > IMPACT_WINDOW_MS) {
    imp.buyQty = 0;
    imp.buyWindowStart = now;
  }
  imp.buyQty += qty;
  if (imp.buyQty > BUY_IMPACT_THRESHOLD) {
    const over = imp.buyQty - BUY_IMPACT_THRESHOLD;
    const bump = Math.min(0.05, over / 500);
    imp.buyPush = Math.min(BUY_IMPACT_CAP, imp.buyPush + bump);
    refreshDisplayedPrice(s, locId, goodId);
  }
}

/**
 * @param {import('./state.js').GameState} s
 * @param {string} locId
 * @param {string} goodId
 * @param {number} qty
 * @returns {{ ok: boolean, reason?: string }}
 */
export function trySell(s, locId, goodId, qty) {
  if (s.travel) return { ok: false, reason: 'traveling' };
  if (s.locationId !== locId) return { ok: false, reason: 'not_here' };
  if (!s.unlocked.includes(locId)) return { ok: false, reason: 'locked' };
  const price = s.prices[locId]?.[goodId];
  if (price == null) return { ok: false, reason: 'no_quote' };
  qty = Math.floor(qty);
  if (qty <= 0) return { ok: false, reason: 'qty' };
  if ((s.cargo[goodId] || 0) < qty) return { ok: false, reason: 'stock' };

  s.cargo[goodId] -= qty;
  s.gold += price * qty;
  applySellImpact(s, locId, goodId, qty);
  return { ok: true };
}

/**
 * @param {import('./state.js').GameState} s
 * @param {string} locId
 * @param {string} goodId
 * @param {number} qty
 */
function applySellImpact(s, locId, goodId, qty) {
  const imp = s.impact[locId][goodId];
  const now = s.nowMs;
  if (now - imp.sellWindowStart > IMPACT_WINDOW_MS) {
    imp.sellQty = 0;
    imp.sellWindowStart = now;
  }
  imp.sellQty += qty;
  if (imp.sellQty > SELL_IMPACT_THRESHOLD) {
    const over = imp.sellQty - SELL_IMPACT_THRESHOLD;
    const bump = Math.min(0.03, over / 600);
    imp.sellPush = Math.min(SELL_IMPACT_CAP, imp.sellPush + bump);
    refreshDisplayedPrice(s, locId, goodId);
  }
}

/**
 * @param {import('./state.js').GameState} s
 * @param {string} toId
 * @param {number} durationMs
 * @returns {{ ok: boolean, reason?: string }}
 */
export function tryTravel(s, toId, durationMs) {
  if (s.travel) return { ok: false, reason: 'traveling' };
  if (!s.unlocked.includes(toId)) return { ok: false, reason: 'locked' };
  if (toId === s.locationId) return { ok: false, reason: 'same' };
  if (durationMs == null || durationMs <= 0) return { ok: false, reason: 'no_edge' };

  s.travel = {
    from: s.locationId,
    to: toId,
    elapsedMs: 0,
    durationMs,
  };
  return { ok: true };
}

/**
 * Hand in specialty unlock for z1c at current (unlocked) station.
 * @param {import('./state.js').GameState} s
 * @param {{ target: string, costs: { goodId: string, qty: number }[] }} unlock
 * @returns {{ ok: boolean, reason?: string }}
 */
export function tryUnlock(s, unlock) {
  if (s.travel) return { ok: false, reason: 'traveling' };
  if (!s.unlocked.includes(s.locationId)) return { ok: false, reason: 'locked_here' };
  if (s.unlocked.includes(unlock.target)) return { ok: false, reason: 'already' };
  for (const c of unlock.costs) {
    if ((s.cargo[c.goodId] || 0) < c.qty) return { ok: false, reason: 'need_' + c.goodId };
  }
  for (const c of unlock.costs) {
    s.cargo[c.goodId] -= c.qty;
  }
  s.unlocked.push(unlock.target);
  return { ok: true };
}
