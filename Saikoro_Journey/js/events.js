import { neighborsOf, travelMsBetween, distanceBetween, locName } from './map-data.js?v=z1-20261028ao';
import { unlockByTarget, goodName, goodWeightG, STOP_REROUTE_UNLOCKED, effectiveSpeed, AREA1_WAREHOUSE_CAP } from './economy-data.js?v=z1-20261028ao';
import {
  tryBuy, trySell, tryTravel, tryUnlock, tryDepositUnlock, tryUpgradeCapacity, tryUpgradePreserve, tryUpgradeSpeed, tryStopTravel, tryReroute,
  tryAcceptQuest, tryDeliverQuest, tryAbandonQuest,
  tryHireCourier, trySetCourierPaused, trySetCourierRoute, trySetCourierTradeFlag,
  tryTransferGold, tryTransferGood,
  tryWarehouseDeposit, tryWarehouseWithdraw,
} from './engine.js?v=z1-20261028ao';
import { cargoUsed, courierCargoUsed, warehouseUsed } from './state.js?v=z1-20261028ao';
import { saveGame, clearSave } from './saving.js?v=z1-20261028ao';
import { render, invalidateQuotes, focusQtyAfterTrade, flashTradedRow, flashUnlockedNode } from './view.js?v=z1-20261028ao';

/** @type {import('./state.js').GameState | null} */
let state = null;
/** @type {{ lastMsg: string, panelOpen: boolean, optionsOpen: boolean, characterOpen: boolean }} */
const ui = { lastMsg: '', panelOpen: true, optionsOpen: false, characterOpen: false, warehouseWho: 'player' };

/** @param {import('./state.js').GameState} s */
export function bindEvents(s, opts = {}) {
  state = s;
  const opening = opts.opening || null;

  const optionsBtn = document.getElementById('btn-options');
  const optionsMenu = document.getElementById('options-menu');

  const characterPanel = document.getElementById('character-panel');

  function setOptionsOpen(open) {
    ui.optionsOpen = !!open;
    if (optionsMenu) optionsMenu.hidden = !ui.optionsOpen;
    if (optionsBtn) optionsBtn.setAttribute('aria-expanded', ui.optionsOpen ? 'true' : 'false');
  }

  function setCharacterOpen(open) {
    ui.characterOpen = !!open;
    if (characterPanel) characterPanel.hidden = !ui.characterOpen;
    if (ui.characterOpen) {
      setOptionsOpen(false);
      if (state) render(state, ui);
    }
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
    if (ui.characterOpen) {
      setCharacterOpen(false);
      return;
    }
    setOptionsOpen(!ui.optionsOpen);
  });

  document.getElementById('character-entry')?.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button[data-act="character"]');
    if (!btn) return;
    ev.stopPropagation();
    setCharacterOpen(true);
  });

  document.getElementById('btn-character-close')?.addEventListener('click', (ev) => {
    ev.stopPropagation();
    setCharacterOpen(false);
  });

  characterPanel?.addEventListener('click', (ev) => {
    // backdrop click closes; clicks inside card stay open
    if (ev.target === characterPanel) setCharacterOpen(false);
  });

  document.addEventListener('click', (ev) => {
    if (!ui.optionsOpen) return;
    if (ev.target.closest('.options-wrap')) return;
    if (ev.target.closest('#character-panel')) return;
    setOptionsOpen(false);
  });

  document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Escape') return;
    if (ui.characterOpen) {
      setCharacterOpen(false);
      return;
    }
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
    if (ui.characterOpen) setCharacterOpen(false);
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
      const spd = effectiveSpeed(state.speedLevel);
      const ms = travelMsBetween(fromId, locId, spd);
      const r = tryReroute(state, locId, ms, { distance: dist ?? 0, speed: spd });
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
    const spd = effectiveSpeed(state.speedLevel);
    const ms = travelMsBetween(state.locationId, locId, spd);
    const r = tryTravel(state, locId, ms, { distance: dist ?? 0, speed: spd });
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
    const target = btn.dataset.target;
    const unlock = unlockByTarget(target);
    if (!unlock) {
      ui.lastMsg = 'unlock failed (unknown)';
      render(state, ui);
      return;
    }
    const r = tryDepositUnlock(state, unlock);
    if (r.ok && r.unlocked) {
      ui.lastMsg = `unlocked ${locName(unlock.target)}`;
      saveGame(state);
      invalidateQuotes();
      flashUnlockedNode(unlock.target);
    } else if (r.ok) {
      ui.lastMsg = `handed in toward ${locName(unlock.target)}`;
      saveGame(state);
    } else {
      ui.lastMsg = `unlock failed (${r.reason})`;
    }
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

  // Slice Q — hire / route / trade / transfer
  document.getElementById('courier-hire-panel')?.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button[data-act="hire-courier"]');
    if (!btn || !state) return;
    const r = tryHireCourier(state);
    ui.lastMsg = r.ok ? 'courier hired' : `hire failed (${r.reason})`;
    if (r.ok) { saveGame(state); invalidateQuotes(); }
    render(state, ui);
  });

  document.getElementById('courier-panel')?.addEventListener('click', (ev) => {
    if (!state || !state.courier) return;
    const pause = ev.target.closest('button[data-act="courier-pause"]');
    const resume = ev.target.closest('button[data-act="courier-resume"]');
    if (pause) {
      trySetCourierPaused(state, true);
      ui.lastMsg = 'courier paused';
      saveGame(state);
      render(state, ui);
      return;
    }
    if (resume) {
      trySetCourierPaused(state, false);
      ui.lastMsg = 'courier resumed';
      saveGame(state);
      render(state, ui);
      return;
    }
    const up = ev.target.closest('button[data-act="courier-route-up"]');
    const down = ev.target.closest('button[data-act="courier-route-down"]');
    const rm = ev.target.closest('button[data-act="courier-route-rm"]');
    const add = ev.target.closest('button[data-act="courier-route-add"]');
    let route = [...state.courier.route];
    if (up) {
      const i = Number(up.dataset.idx);
      if (i > 0) {
        [route[i - 1], route[i]] = [route[i], route[i - 1]];
        trySetCourierRoute(state, route);
        saveGame(state);
        render(state, ui);
      }
      return;
    }
    if (down) {
      const i = Number(down.dataset.idx);
      if (i < route.length - 1) {
        [route[i], route[i + 1]] = [route[i + 1], route[i]];
        trySetCourierRoute(state, route);
        saveGame(state);
        render(state, ui);
      }
      return;
    }
    if (rm) {
      const i = Number(rm.dataset.idx);
      route.splice(i, 1);
      const r = trySetCourierRoute(state, route);
      ui.lastMsg = r.ok ? (route.length < 2 ? 'courier docked (need ≥2 stops)' : 'route updated') : `route failed (${r.reason})`;
      if (r.ok) saveGame(state);
      render(state, ui);
      return;
    }
    if (add) {
      route.push(add.dataset.loc);
      const r = trySetCourierRoute(state, route);
      ui.lastMsg = r.ok ? 'stop added' : `add failed (${r.reason})`;
      if (r.ok) saveGame(state);
      render(state, ui);
    }
  });

  document.getElementById('courier-panel')?.addEventListener('change', (ev) => {
    const el = ev.target.closest('input[data-act="courier-trade"]');
    if (!el || !state) return;
    const want = !!el.checked;
    const r = trySetCourierTradeFlag(state, el.dataset.loc, el.dataset.good, el.dataset.side, want);
    if (!r.ok) {
      el.checked = !want;
      ui.lastMsg = `trade toggle failed (${r.reason})`;
      render(state, ui);
      return;
    }
    const flags = state.courier?.trade?.[el.dataset.loc]?.[el.dataset.good];
    if (flags) el.checked = !!flags[el.dataset.side];
    saveGame(state);
    invalidateQuotes();
  });

  document.getElementById('transfer-panel')?.addEventListener('click', (ev) => {
    if (!state) return;
    const gToC = ev.target.closest('button[data-act="xfer-gold-to-courier"]');
    const gToP = ev.target.closest('button[data-act="xfer-gold-to-player"]');
    const goodToC = ev.target.closest('button[data-act="xfer-good-to-courier"]');
    const goodToP = ev.target.closest('button[data-act="xfer-good-to-player"]');
    if (gToC || gToP) {
      const qty = Number(document.getElementById('xfer-gold-qty')?.value || 0);
      const r = tryTransferGold(state, gToC ? 'toCourier' : 'toPlayer', qty);
      ui.lastMsg = r.ok ? `transferred ${qty}G` : `transfer failed (${r.reason})`;
      if (r.ok) { saveGame(state); invalidateQuotes(); }
      render(state, ui);
      return;
    }
    if (goodToC || goodToP) {
      const good = (goodToC || goodToP).dataset.good;
      const input = document.querySelector(`input[data-xfer-good="${good}"]`);
      const qty = Number(input?.value || 1);
      const r = tryTransferGood(state, good, goodToC ? 'toCourier' : 'toPlayer', qty);
      ui.lastMsg = r.ok ? `transferred ${goodName(good)} ×${qty}` : `transfer failed (${r.reason})`;
      if (r.ok) { saveGame(state); invalidateQuotes(); }
      render(state, ui);
    }
  });

  document.getElementById('warehouse-panel')?.addEventListener('click', (ev) => {
    if (!state) return;
    const tabP = ev.target.closest('button[data-act="wh-tab-player"]');
    const tabC = ev.target.closest('button[data-act="wh-tab-courier"]');
    if (tabP) {
      ui.warehouseWho = 'player';
      render(state, ui);
      return;
    }
    if (tabC) {
      ui.warehouseWho = 'courier';
      render(state, ui);
      return;
    }
    const dep = ev.target.closest('button[data-act="wh-deposit"]');
    const wit = ev.target.closest('button[data-act="wh-withdraw"]');
    if (!dep && !wit) return;
    const btn = dep || wit;
    const good = btn.dataset.good;
    const mode = btn.dataset.mode || 'qty';
    const who = ui.warehouseWho === 'courier' ? 'courier' : 'player';
    const bag = who === 'courier' ? state.courier : state;
    if (!bag) {
      ui.lastMsg = 'warehouse failed (no_courier)';
      render(state, ui);
      return;
    }
    let qty = 0;
    if (dep) {
      const have = bag.cargo[good] || 0;
      if (mode === 'all') {
        qty = have;
        // also clamp to remaining warehouse cap
        const w = goodWeightG(good);
        if (w > 0) {
          const freeWh = Math.max(0, AREA1_WAREHOUSE_CAP - warehouseUsed(state));
          qty = Math.min(qty, Math.floor(freeWh / w));
        }
      } else {
        const input = document.querySelector(`input[data-wh-qty="${good}"]`);
        qty = Number(input?.value || 1);
      }
      const r = tryWarehouseDeposit(state, who, good, qty);
      ui.lastMsg = r.ok
        ? `deposited ${goodName(good)} ×${qty} → warehouse`
        : `deposit failed (${r.reason})`;
      if (r.ok) { saveGame(state); invalidateQuotes(); }
      render(state, ui);
      return;
    }
    if (wit) {
      const whHave = state.warehouse?.area1?.cargo?.[good] || 0;
      if (mode === 'max') {
        const w = goodWeightG(good);
        const used = who === 'courier' ? courierCargoUsed(state.courier) : cargoUsed(state);
        const cap = who === 'courier' ? state.courier.capacity : state.capacity;
        const free = Math.max(0, cap - used);
        qty = w > 0 ? Math.min(whHave, Math.floor(free / w)) : 0;
      } else {
        const input = document.querySelector(`input[data-wh-qty="${good}"]`);
        qty = Number(input?.value || 1);
      }
      const r = tryWarehouseWithdraw(state, who, good, qty);
      ui.lastMsg = r.ok
        ? `withdrew ${goodName(good)} ×${qty} → ${who === 'courier' ? 'courier' : 'cargo'}`
        : `withdraw failed (${r.reason})`;
      if (r.ok) { saveGame(state); invalidateQuotes(); }
      render(state, ui);
    }
  });

  document.getElementById('cargo-upgrade-panel')?.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button[data-act="upgrade-cargo"]');
    if (!btn || !state) return;
    const r = tryUpgradeCapacity(state);
    if (r.ok) {
      ui.lastMsg = `cargo upgraded to lv${r.level} (${r.capacity}g) −${r.cost}G`;
      saveGame(state);
      invalidateQuotes();
    } else {
      ui.lastMsg = `upgrade failed (${r.reason})`;
    }
    render(state, ui);
  });

  document.getElementById('preserve-upgrade-panel')?.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button[data-act="upgrade-preserve"]');
    if (!btn || !state) return;
    const r = tryUpgradePreserve(state);
    if (r.ok) {
      ui.lastMsg = `preserve upgraded to lv${r.level} −${r.cost}G`;
      saveGame(state);
      invalidateQuotes();
    } else {
      ui.lastMsg = `preserve upgrade failed (${r.reason})`;
    }
    render(state, ui);
  });

  document.getElementById('speed-upgrade-panel')?.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button[data-act="upgrade-speed"]');
    if (!btn || !state) return;
    const r = tryUpgradeSpeed(state);
    if (r.ok) {
      ui.lastMsg = `speed upgraded to lv${r.level} (spd ${r.speed}) −${r.cost}G`;
      saveGame(state);
      invalidateQuotes();
    } else {
      ui.lastMsg = `speed upgrade failed (${r.reason})`;
    }
    render(state, ui);
  });

  document.getElementById('save-panel')?.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button[data-act]');
    if (!btn || !state) return;
    if (btn.dataset.act === 'save') {
      ui.lastMsg = saveGame(state) ? 'saved' : 'save failed';
    } else if (btn.dataset.act === 'new-game') {
      if (!confirm('New game? This clears the current save and restarts the opening.')) return;
      clearSave();
      if (opening && typeof opening.restart === 'function') {
        opening.restart();
        ui.lastMsg = 'new game';
      } else {
        ui.lastMsg = 'new game — reload page';
      }
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
