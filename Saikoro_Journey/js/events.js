import { neighborsOf, travelMsBetween, locName } from './map-data.js';
import { UNLOCK_LOC3, goodName } from './economy-data.js';
import { tryBuy, trySell, tryTravel, tryUnlock } from './engine.js';
import { cargoUsed } from './state.js';
import { saveGame, clearSave } from './saving.js';
import { render, invalidateQuotes } from './view.js';

/** @type {import('./state.js').GameState | null} */
let state = null;
/** @type {{ lastMsg: string }} */
const ui = { lastMsg: '' };

/** @param {import('./state.js').GameState} s */
export function bindEvents(s) {
  state = s;

  document.getElementById('quote-panel')?.addEventListener('input', (ev) => {
    const el = ev.target.closest('input.qty[data-qty]');
    if (!el) return;
    // value kept in DOM; view captures before any rebuild
  });

  document.getElementById('nodes')?.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.node');
    if (!btn || !state) return;
    const locId = btn.dataset.locId;
    if (!state.unlocked.includes(locId)) {
      ui.lastMsg = 'location locked';
      render(state, ui);
      return;
    }

    if (state.travel) {
      ui.lastMsg = 'already traveling';
      render(state, ui);
      return;
    }
    state.selectedLocId = locId;

    if (locId !== state.locationId) {
      const neigh = neighborsOf(state.locationId);
      if (neigh.includes(locId)) {
        const ms = travelMsBetween(state.locationId, locId);
        const r = tryTravel(state, locId, ms);
        ui.lastMsg = r.ok ? `departing → ${locName(locId)}` : `cannot travel (${r.reason})`;
        if (r.ok) { saveGame(state); invalidateQuotes(); }
      } else {
        ui.lastMsg = 'only adjacent locations';
      }
    } else {
      ui.lastMsg = locName(locId);
    }
    render(state, ui);
  });

  document.getElementById('quote-panel')?.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button[data-act]');
    if (!btn || !state) return;
    const act = btn.dataset.act;
    const good = btn.dataset.good;
    const loc = btn.dataset.loc;
    const row = btn.closest('tr');
    const qtyInput = row?.querySelector(`input[data-qty="${good}"]`);
    const qty = Number(qtyInput?.value || 1);

    if (act === 'buy' || act === 'buy-max') {
      let n = qty;
      if (act === 'buy-max') {
        const price = state.prices[loc]?.[good] || 1;
        const byGold = Math.floor(state.gold / price);
        const byCap = state.capacity - cargoUsed(state);
        n = Math.max(0, Math.min(byGold, byCap));
      }
      const r = tryBuy(state, loc, good, n);
      ui.lastMsg = r.ok ? `bought ${goodName(good)} ×${n}` : `buy failed (${r.reason})`;
      if (r.ok) { saveGame(state); invalidateQuotes(); }
    } else if (act === 'sell' || act === 'sell-all') {
      let n = qty;
      if (act === 'sell-all') n = state.cargo[good] || 0;
      const r = trySell(state, loc, good, n);
      ui.lastMsg = r.ok ? `sold ${goodName(good)} ×${n}` : `sell failed (${r.reason})`;
      if (r.ok) { saveGame(state); invalidateQuotes(); }
    }
    render(state, ui);
  });

  document.getElementById('unlock-panel')?.addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-act="unlock"]');
    if (!btn || !state) return;
    const r = tryUnlock(state, UNLOCK_LOC3);
    ui.lastMsg = r.ok ? `unlocked ${locName(UNLOCK_LOC3.target)}` : `unlock failed (${r.reason})`;
    if (r.ok) { saveGame(state); invalidateQuotes(); }
    render(state, ui);
  });

  document.getElementById('save-panel')?.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button[data-act]');
    if (!btn || !state) return;
    if (btn.dataset.act === 'save') {
      ui.lastMsg = saveGame(state) ? 'saved' : 'save failed';
    } else if (btn.dataset.act === 'reset-save') {
      clearSave();
      ui.lastMsg = 'save cleared — reload page for fresh start';
    }
    render(state, ui);
  });
}

export function getUi() {
  return ui;
}
