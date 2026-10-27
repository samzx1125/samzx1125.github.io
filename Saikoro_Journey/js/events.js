import { neighborsOf, travelMsBetween } from './map-data.js';
import { UNLOCK_LOC3 } from './economy-data.js';
import { tryBuy, trySell, tryTravel, tryUnlock } from './engine.js';
import { render } from './view.js';

/** @type {import('./state.js').GameState | null} */
let state = null;
/** @type {{ lastMsg: string }} */
const ui = { lastMsg: '' };

/** @param {import('./state.js').GameState} s */
export function bindEvents(s) {
  state = s;

  document.getElementById('nodes')?.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.node');
    if (!btn || !state) return;
    const locId = btn.dataset.locId;
    if (!state.unlocked.includes(locId)) {
      ui.lastMsg = 'location locked';
      render(state, ui);
      return;
    }
    state.selectedLocId = locId;

    if (state.travel) {
      ui.lastMsg = 'already traveling';
      render(state, ui);
      return;
    }

    if (locId !== state.locationId) {
      const neigh = neighborsOf(state.locationId);
      if (neigh.includes(locId)) {
        const ms = travelMsBetween(state.locationId, locId);
        const r = tryTravel(state, locId, ms);
        ui.lastMsg = r.ok ? `departing → ${locId}` : `cannot travel (${r.reason})`;
      } else {
        ui.lastMsg = 'only adjacent locations';
      }
    } else {
      ui.lastMsg = locId;
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

    if (act === 'buy') {
      const r = tryBuy(state, loc, good, qty);
      ui.lastMsg = r.ok ? `bought ${good} ×${qty}` : `buy failed (${r.reason})`;
    } else if (act === 'sell') {
      const r = trySell(state, loc, good, qty);
      ui.lastMsg = r.ok ? `sold ${good} ×${qty}` : `sell failed (${r.reason})`;
    }
    render(state, ui);
  });

  document.getElementById('unlock-panel')?.addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-act="unlock"]');
    if (!btn || !state) return;
    const r = tryUnlock(state, UNLOCK_LOC3);
    ui.lastMsg = r.ok ? `unlocked ${UNLOCK_LOC3.target}` : `unlock failed (${r.reason})`;
    render(state, ui);
  });
}

export function getUi() {
  return ui;
}
