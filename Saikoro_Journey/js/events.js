import { neighborsOf, travelMsBetween, locName } from './map-data.js?v=z1-20261027u';
import { UNLOCK_LOC3, goodName } from './economy-data.js?v=z1-20261027u';
import { tryBuy, trySell, tryTravel, tryUnlock } from './engine.js?v=z1-20261027u';
import { cargoUsed } from './state.js?v=z1-20261027u';
import { saveGame, clearSave } from './saving.js?v=z1-20261027u';
import { render, invalidateQuotes, focusQtyAfterTrade } from './view.js?v=z1-20261027u';

/** @type {import('./state.js').GameState | null} */
let state = null;
/** @type {{ lastMsg: string }} */
const ui = { lastMsg: '' };

/** @param {import('./state.js').GameState} s */
export function bindEvents(s) {
  state = s;

  document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Escape') return;
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = '';
    toast.classList.add('fade');
    ui.lastMsg = '';
    document.dispatchEvent(new Event('sj-toast-clear'));
  });

  document.getElementById('quote-panel')?.addEventListener('input', (ev) => {
    const el = ev.target.closest('input.qty[data-qty]');
    if (!el) return;
    // value kept in DOM; view captures before any rebuild
  });


  document.getElementById('quote-panel')?.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter' || !state) return;
    const input = ev.target.closest('input.qty[data-qty]');
    if (!input) return;
    ev.preventDefault();
    const row = input.closest('tr');
    let act = 'buy';
    if (ev.shiftKey && ev.altKey) act = 'sell-all';
    else if (ev.shiftKey) act = 'sell';
    else if (ev.altKey) act = 'buy-max';
    const btn = row?.querySelector(`button[data-act="${act}"]`);
    if (btn && !btn.disabled) btn.click();
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


  const destPanel = document.getElementById('dest-panel');
  destPanel?.addEventListener('pointerover', (ev) => {
    const btn = ev.target.closest('button[data-act="go"]');
    document.querySelectorAll('.node.hover-dest').forEach((n) => n.classList.remove('hover-dest'));
    if (!btn) return;
    const node = document.querySelector(`.node[data-loc-id="${btn.dataset.loc}"]`);
    node?.classList.add('hover-dest');
  });
  destPanel?.addEventListener('pointerleave', () => {
    document.querySelectorAll('.node.hover-dest').forEach((n) => n.classList.remove('hover-dest'));
  });

  document.getElementById('dest-panel')?.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button[data-act="go"]');
    if (!btn || !state) return;
    if (state.travel) {
      ui.lastMsg = 'already traveling';
      render(state, ui);
      return;
    }
    const locId = btn.dataset.loc;
    if (!state.unlocked.includes(locId)) {
      ui.lastMsg = 'location locked';
      render(state, ui);
      return;
    }
    const ms = travelMsBetween(state.locationId, locId);
    if (ms == null) {
      ui.lastMsg = 'only adjacent locations';
      render(state, ui);
      return;
    }
    state.selectedLocId = locId;
    const r = tryTravel(state, locId, ms);
    ui.lastMsg = r.ok ? `departing → ${locName(locId)}` : `cannot travel (${r.reason})`;
    if (r.ok) { saveGame(state); invalidateQuotes(); }
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
      if (r.ok) { saveGame(state); invalidateQuotes(); focusQtyAfterTrade(good); }
    } else if (act === 'sell' || act === 'sell-all') {
      let n = qty;
      if (act === 'sell-all') n = state.cargo[good] || 0;
      const r = trySell(state, loc, good, n);
      ui.lastMsg = r.ok ? `sold ${goodName(good)} ×${n}` : `sell failed (${r.reason})`;
      if (r.ok) { saveGame(state); invalidateQuotes(); focusQtyAfterTrade(good); }
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
