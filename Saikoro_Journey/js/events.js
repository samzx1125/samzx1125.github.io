import { neighborsOf, travelMsBetween, distanceBetween, TRAIN_SPEED, locName } from './map-data.js?v=z1-20261028z';
import { UNLOCK_LOC3, goodName, goodWeightG, STOP_REROUTE_UNLOCKED } from './economy-data.js?v=z1-20261028z';
import { tryBuy, trySell, tryTravel, tryUnlock, tryStopTravel, tryReroute, tryAcceptQuest, tryDeliverQuest, tryAbandonQuest } from './engine.js?v=z1-20261028z';
import { cargoUsed } from './state.js?v=z1-20261028z';
import { saveGame, clearSave } from './saving.js?v=z1-20261028z';
import { render, invalidateQuotes, focusQtyAfterTrade, flashTradedRow, flashUnlockedNode } from './view.js?v=z1-20261028z';

/** @type {import('./state.js').GameState | null} */
let state = null;
/** @type {{ lastMsg: string, panelOpen: boolean, optionsOpen: boolean }} */
const ui = { lastMsg: '', panelOpen: true, optionsOpen: false };

/** @param {import('./state.js').GameState} s */
export function bindEvents(s) {
  state = s;

  const optionsBtn = document.getElementById('btn-options');
  const optionsMenu = document.getElementById('options-menu');

  function setOptionsOpen(open) {
    ui.optionsOpen = !!open;
    if (optionsMenu) optionsMenu.hidden = !ui.optionsOpen;
    if (optionsBtn) optionsBtn.setAttribute('aria-expanded', ui.optionsOpen ? 'true' : 'false');
  }

  /** Close location/unlock panels + clear toast (Esc / blank map). */
  function closePanelsAndToast() {
    let closed = false;
    if (ui.panelOpen) {
      ui.panelOpen = false;
      closed = true;
    }
    const toast = document.getElementById('toast');
    if (toast) {
      toast.textContent = '';
      toast.classList.add('fade');
    }
    ui.lastMsg = '';
    document.dispatchEvent(new Event('sj-toast-clear'));
    if (closed && state) render(state, ui);
  }

  optionsBtn?.addEventListener('click', (ev) => {
    ev.stopPropagation();
    setOptionsOpen(!ui.optionsOpen);
  });

  document.addEventListener('click', (ev) => {
    if (!ui.optionsOpen) return;
    if (ev.target.closest('.options-wrap')) return;
    setOptionsOpen(false);
  });

  document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Escape') return;
    if (ui.optionsOpen) {
      setOptionsOpen(false);
      return;
    }
    closePanelsAndToast();
  });

  // Blank map click closes panels (same as Esc); node clicks keep panel open
  document.getElementById('map-wrap')?.addEventListener('click', (ev) => {
    if (ev.target.closest('.node')) return;
    if (ev.target.closest('button[data-act="travel-to"]')) return;
    if (ui.optionsOpen) setOptionsOpen(false);
    closePanelsAndToast();
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

  /** Depart to locId if adjacent / unlocked; re-route mid-travel if feature unlocked. */
  function travelTo(locId) {
    if (!state || !locId) return;
    if (state.travel) {
      if (!STOP_REROUTE_UNLOCKED) {
        ui.lastMsg = 'already traveling (stop/re-route locked)';
        render(state, ui);
        return;
      }
      if (!state.unlocked.includes(locId)) {
        ui.lastMsg = 'location locked';
        render(state, ui);
        return;
      }
      const fromId = state.locationId;
      if (locId !== fromId && !neighborsOf(fromId).includes(locId)) {
        ui.lastMsg = 'only adjacent locations';
        render(state, ui);
        return;
      }
      const dist = distanceBetween(fromId, locId);
      const ms = travelMsBetween(fromId, locId);
      const r = tryReroute(state, locId, ms, { distance: dist ?? 0, speed: TRAIN_SPEED });
      ui.lastMsg = r.ok
        ? (r.stopped ? 'stopped' : `re-routed → ${locName(locId)}`)
        : `cannot re-route (${r.reason})`;
      if (r.ok) { saveGame(state); invalidateQuotes(); }
      render(state, ui);
      return;
    }
    if (!state.unlocked.includes(locId)) {
      ui.lastMsg = 'location locked';
      render(state, ui);
      return;
    }
    if (locId === state.locationId) {
      ui.lastMsg = 'already here';
      render(state, ui);
      return;
    }
    const neigh = neighborsOf(state.locationId);
    if (!neigh.includes(locId)) {
      ui.lastMsg = 'only adjacent locations';
      render(state, ui);
      return;
    }
    const dist = distanceBetween(state.locationId, locId);
    const ms = travelMsBetween(state.locationId, locId);
    const r = tryTravel(state, locId, ms, { distance: dist ?? 0, speed: TRAIN_SPEED });
    ui.lastMsg = r.ok ? `departing → ${locName(locId)}` : `cannot travel (${r.reason})`;
    if (r.ok) { saveGame(state); invalidateQuotes(); }
    render(state, ui);
  }

  document.getElementById('nodes')?.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.node');
    if (!btn || !state) return;
    const locId = btn.dataset.locId;
    if (!state.unlocked.includes(locId)) {
      ui.lastMsg = 'location locked';
      render(state, ui);
      return;
    }

    if (state.travel && !STOP_REROUTE_UNLOCKED) {
      ui.lastMsg = 'already traveling';
      render(state, ui);
      return;
    }
    // Slice D/J: open location panel — travel / re-route via Travel to / Destinations / map chip
    state.selectedLocId = locId;
    ui.panelOpen = true;
    if (state.travel && STOP_REROUTE_UNLOCKED) {
      if (locId === state.locationId) ui.lastMsg = locName(locId) + ' (origin · Stop)';
      else if (locId === state.travel.to) ui.lastMsg = locName(locId) + ' (current dest)';
      else if (!neighborsOf(state.locationId).includes(locId)) ui.lastMsg = 'only adjacent locations';
      else ui.lastMsg = 're-route? ' + locName(locId);
    } else if (locId === state.locationId) {
      ui.lastMsg = locName(locId);
    } else if (!neighborsOf(state.locationId).includes(locId)) {
      ui.lastMsg = 'only adjacent locations';
    } else {
      ui.lastMsg = locName(locId);
    }
    render(state, ui);
  });

  document.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button[data-act="travel-to"]');
    if (!btn || !state) return;
    const locId = btn.dataset.loc || state.selectedLocId || state.locationId;
    travelTo(locId);
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
    const locId = btn.dataset.loc;
    state.selectedLocId = locId;
    ui.panelOpen = true;
    travelTo(locId);
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
        const w = goodWeightG(good);
        const byCap = w > 0 ? Math.floor((state.capacity - cargoUsed(state)) / w) : 0;
        n = Math.max(0, Math.min(byGold, byCap));
      }
      const r = tryBuy(state, loc, good, n);
      ui.lastMsg = r.ok ? `bought ${goodName(good)} ×${n}` : `buy failed (${r.reason})`;
      if (r.ok) { saveGame(state); invalidateQuotes(); focusQtyAfterTrade(good); flashTradedRow(good); }
    } else if (act === 'sell' || act === 'sell-all') {
      let n = qty;
      if (act === 'sell-all') n = state.cargo[good] || 0;
      const r = trySell(state, loc, good, n);
      ui.lastMsg = r.ok ? `sold ${goodName(good)} ×${n}` : `sell failed (${r.reason})`;
      if (r.ok) { saveGame(state); invalidateQuotes(); focusQtyAfterTrade(good); flashTradedRow(good); }
    }
    render(state, ui);
  });

  document.getElementById('unlock-panel')?.addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-act="unlock"]');
    if (!btn || !state) return;
    const r = tryUnlock(state, UNLOCK_LOC3);
    ui.lastMsg = r.ok ? `unlocked ${locName(UNLOCK_LOC3.target)}` : `unlock failed (${r.reason})`;
    if (r.ok) { saveGame(state); invalidateQuotes(); flashUnlockedNode(UNLOCK_LOC3.target); }
    render(state, ui);
  });

  document.getElementById('travel-panel')?.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button[data-act="stop-travel"]');
    if (!btn || !state) return;
    const r = tryStopTravel(state);
    ui.lastMsg = r.ok ? 'stopped' : `cannot stop (${r.reason})`;
    if (r.ok) { saveGame(state); invalidateQuotes(); }
    render(state, ui);
  });

  document.getElementById('quest-offer-panel')?.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button[data-act="quest-accept"]');
    if (!btn || !state) return;
    const r = tryAcceptQuest(state);
    ui.lastMsg = r.ok ? 'quest accepted' : `cannot accept (${r.reason})`;
    if (r.ok) { saveGame(state); invalidateQuotes(); }
    render(state, ui);
  });

  document.getElementById('quest-active-panel')?.addEventListener('click', (ev) => {
    if (!state) return;
    const deliver = ev.target.closest('button[data-act="quest-deliver"]');
    const abandon = ev.target.closest('button[data-act="quest-abandon"]');
    if (deliver) {
      const r = tryDeliverQuest(state);
      ui.lastMsg = r.ok ? `delivered +${r.reward}G` : `cannot deliver (${r.reason})`;
      if (r.ok || r.reason === 'waste') { saveGame(state); invalidateQuotes(); }
      render(state, ui);
      return;
    }
    if (abandon) {
      const r = tryAbandonQuest(state);
      ui.lastMsg = r.ok ? 'quest failed (abandoned)' : `cannot abandon (${r.reason})`;
      if (r.ok) { saveGame(state); invalidateQuotes(); }
      render(state, ui);
    }
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
