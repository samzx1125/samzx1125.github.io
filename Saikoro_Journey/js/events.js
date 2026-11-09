import { neighborsOf, travelMsBetween, distanceBetween, locName } from './map-data.js?v=z1-20261028cu';
import { unlockByTarget, goodName, goodWeightG, STOP_REROUTE_UNLOCKED, effectiveSpeed, WAREHOUSE_CAP, areaBridgeBlockReason } from './economy-data.js?v=z1-20261028cu';
import {
  tryBuy, trySell, tryTravel, tryUnlock, tryDepositUnlock, tryUpgradeCapacity, tryUpgradePreserve, tryUpgradeSpeed, tryStopTravel, tryReroute,
  tryAcceptQuest, tryDeliverQuest, tryAbandonQuest,
  tryHireCourier, trySetCourierPaused, trySetCourierRoute, trySetCourierTradeFlag,
  tryTransferGold, tryTransferGood,
  tryWarehouseDeposit, tryWarehouseWithdraw,
  courierLocAllowed,
} from './engine.js?v=z1-20261028cu';
import { cargoUsed, courierCargoUsed, warehouseUsed, warehouseKeyAtPlayer, ensureWarehouse, stacksQtyOf, findStack } from './state.js?v=z1-20261028cu';
import { saveGame, clearSave, serialize } from './saving.js?v=z1-20261028cu';
import { render, invalidateQuotes, focusQtyAfterTrade, flashTradedRow, flashUnlockedNode } from './view.js?v=z1-20261028cu';
import { KEY_MIRROR_RESIDUE } from './personal-data.js?v=z1-20261028cu';

/** @type {import('./state.js').GameState | null} */
let state = null;
/** @type {{ lastMsg: string, panelOpen: boolean, optionsOpen: boolean, upgradesOpen: boolean, characterOpen: boolean }} */
const ui = { lastMsg: '', panelOpen: true, optionsOpen: false, upgradesOpen: false, characterOpen: false, warehouseWho: 'player', warehouseSel: null };

/** @param {import('./state.js').GameState} s */
export function bindEvents(s, opts = {}) {
  state = s;
  const opening = opts.opening || null;

  const optionsBtn = document.getElementById('btn-options');
  const optionsMenu = document.getElementById('options-menu');
  const upgradesBtn = document.getElementById('btn-upgrades');
  const upgradesMenu = document.getElementById('upgrades-menu');

  const characterPanel = document.getElementById('character-panel');

  function setOptionsOpen(open) {
    ui.optionsOpen = !!open;
    if (optionsMenu) optionsMenu.hidden = !ui.optionsOpen;
    if (optionsBtn) optionsBtn.setAttribute('aria-expanded', ui.optionsOpen ? 'true' : 'false');
    if (ui.optionsOpen) setUpgradesOpen(false);
  }

  function setUpgradesOpen(open) {
    ui.upgradesOpen = !!open;
    if (upgradesMenu) upgradesMenu.hidden = !ui.upgradesOpen;
    if (upgradesBtn) upgradesBtn.setAttribute('aria-expanded', ui.upgradesOpen ? 'true' : 'false');
    if (ui.upgradesOpen) setOptionsOpen(false);
  }

  function setCharacterOpen(open) {
    ui.characterOpen = !!open;
    if (characterPanel) characterPanel.hidden = !ui.characterOpen;
    if (ui.characterOpen) {
      setOptionsOpen(false);
      setUpgradesOpen(false);
      if (state) render(state, ui);
    }
  }

  function closeHelpPops(exceptId) {
    document.querySelectorAll('.help-pop').forEach((el) => {
      if (exceptId && el.id === exceptId) return;
      el.hidden = true;
    });
    document.querySelectorAll('.help-q').forEach((btn) => {
      if (exceptId && btn.getAttribute('aria-controls') === exceptId) return;
      btn.setAttribute('aria-expanded', 'false');
    });
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
    closeHelpPops();
    if (ui.characterOpen) {
      setCharacterOpen(false);
      return;
    }
    setOptionsOpen(!ui.optionsOpen);
  });

  upgradesBtn?.addEventListener('click', (ev) => {
    ev.stopPropagation();
    closeHelpPops();
    if (ui.characterOpen) {
      setCharacterOpen(false);
      return;
    }
    setUpgradesOpen(!ui.upgradesOpen);
  });

  document.getElementById('btn-mirror')?.addEventListener('click', (ev) => {
    ev.stopPropagation();
    closeHelpPops();
    setCharacterOpen(true);
  });

  // Slice BA — Mirror Residue in personal inventory opens Character (same as Mirror button)
  document.getElementById('personal-list')?.addEventListener('click', (ev) => {
    const tile = ev.target.closest('#personal-list .inv-stack[data-personal]');
    if (!tile) return;
    const id = tile.getAttribute('data-personal');
    if (id !== KEY_MIRROR_RESIDUE) return; // other keys: non-activating for now
    ev.stopPropagation();
    closeHelpPops();
    setCharacterOpen(true);
  });

  document.querySelectorAll('.help-q').forEach((btn) => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const id = btn.getAttribute('aria-controls');
      if (!id) return;
      const pop = document.getElementById(id);
      if (!pop) return;
      const willOpen = pop.hidden;
      closeHelpPops(willOpen ? id : null);
      pop.hidden = !willOpen;
      btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    });
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
    if (ev.target.closest('.help-q') || ev.target.closest('.help-pop')) {
      /* keep open help until outside */
    } else {
      closeHelpPops();
    }
    if (ui.optionsOpen || ui.upgradesOpen) {
      if (!ev.target.closest('.options-wrap') && !ev.target.closest('#character-panel')) {
        setOptionsOpen(false);
        setUpgradesOpen(false);
      }
    }
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
    if (ui.upgradesOpen) {
      setUpgradesOpen(false);
      return;
    }
    const openHelp = document.querySelector('.help-pop:not([hidden])');
    if (openHelp) {
      closeHelpPops();
      return;
    }
    closePanelsAndToast();
  });

  // Blank map click closes panels (same as Esc); node clicks keep panel open
  const mapWrap = document.getElementById('map-wrap');
  /** Set when a map drag exceeded the click threshold — suppresses the trailing click. */
  let mapDidPan = false;
  const MAP_DRAG_THRESHOLD_PX = 5;

  function isMapInteractiveTarget(el) {
    if (!el || typeof el.closest !== 'function') return false;
    return !!(
      el.closest('.node') ||
      el.closest('.map-travel') ||
      el.closest('button') ||
      el.closest('a') ||
      el.closest('input') ||
      el.closest('select') ||
      el.closest('textarea') ||
      el.closest('[data-act]')
    );
  }

  /** Slice AJ — drag map background to pan (#map-wrap scrollLeft/Top). */
  let mapDrag = null; // { pointerId, startX, startY, scrollLeft, scrollTop, moved }
  mapWrap?.addEventListener('pointerdown', (ev) => {
    // Mouse/pen only — touch keeps native overflow scroll
    if (ev.pointerType === 'touch') return;
    if (ev.button != null && ev.button !== 0) return;
    if (isMapInteractiveTarget(ev.target)) return;
    mapDrag = {
      pointerId: ev.pointerId,
      startX: ev.clientX,
      startY: ev.clientY,
      scrollLeft: mapWrap.scrollLeft,
      scrollTop: mapWrap.scrollTop,
      moved: false,
    };
    mapDidPan = false;
    try { mapWrap.setPointerCapture(ev.pointerId); } catch (_) { /* ignore */ }
    mapWrap.classList.add('map-dragging');
    ev.preventDefault();
  });
  mapWrap?.addEventListener('pointermove', (ev) => {
    if (!mapDrag || mapDrag.pointerId !== ev.pointerId) return;
    const dx = ev.clientX - mapDrag.startX;
    const dy = ev.clientY - mapDrag.startY;
    if (!mapDrag.moved && (Math.abs(dx) >= MAP_DRAG_THRESHOLD_PX || Math.abs(dy) >= MAP_DRAG_THRESHOLD_PX)) {
      mapDrag.moved = true;
      mapDidPan = true;
    }
    if (!mapDrag.moved) return;
    mapWrap.scrollLeft = mapDrag.scrollLeft - dx;
    mapWrap.scrollTop = mapDrag.scrollTop - dy;
    ev.preventDefault();
  });
  function endMapDrag(ev) {
    if (!mapDrag) return;
    if (ev && mapDrag.pointerId !== ev.pointerId) return;
    const moved = mapDrag.moved;
    mapDrag = null;
    mapWrap?.classList.remove('map-dragging');
    if (moved) mapDidPan = true;
  }
  mapWrap?.addEventListener('pointerup', endMapDrag);
  mapWrap?.addEventListener('pointercancel', endMapDrag);
  mapWrap?.addEventListener('lostpointercapture', endMapDrag);

  /** Slice AQ/AR — wheel zoom toward pointer.
   * Underfill (scaled < wrap): pad sizer to wrap + offset-anchor via mapZoomOff (clamped);
   *   init half-wrap anchor → natural center. Overflow: scroll-anchor, off=0.
   * Force reflow before assigning scroll so zoom-in/out range is correct. */
  const MAP_PLANE_W = 3800;
  const MAP_PLANE_H = 400;
  const MAP_ZOOM_MIN = 0.5;
  const MAP_ZOOM_MAX = 2.0;
  let mapZoom = 1;
  let mapZoomOffX = 0;
  let mapZoomOffY = 0;
  const mapSizer = document.getElementById('map-zoom-sizer');
  const mapPlane = document.getElementById('map-plane');

  function applyMapZoom(nextZoom, anchorClientX, anchorClientY, force) {
    if (!mapWrap || !mapSizer || !mapPlane) return;
    const z0 = mapZoom;
    const z1 = Math.min(MAP_ZOOM_MAX, Math.max(MAP_ZOOM_MIN, nextZoom));
    if (!force && Math.abs(z1 - z0) < 1e-9) return;

    const rect = mapWrap.getBoundingClientRect();
    const mx = anchorClientX != null ? anchorClientX - rect.left : mapWrap.clientWidth / 2;
    const my = anchorClientY != null ? anchorClientY - rect.top : mapWrap.clientHeight / 2;
    // Unscaled plane coords under the anchor (account for underfill pad offsets).
    const contentX = (mapWrap.scrollLeft + mx - mapZoomOffX) / z0;
    const contentY = (mapWrap.scrollTop + my - mapZoomOffY) / z0;

    mapZoom = z1;
    const scaledW = MAP_PLANE_W * z1;
    const scaledH = MAP_PLANE_H * z1;
    const wrapW = mapWrap.clientWidth;
    const wrapH = mapWrap.clientHeight;

    let sizerW, sizerH, nextScrollLeft, nextScrollTop;
    if (scaledW < wrapW) {
      sizerW = wrapW;
      mapZoomOffX = Math.max(0, Math.min(wrapW - scaledW, mx - contentX * z1));
      nextScrollLeft = 0;
    } else {
      sizerW = scaledW;
      mapZoomOffX = 0;
      nextScrollLeft = contentX * z1 - mx;
    }
    if (scaledH < wrapH) {
      sizerH = wrapH;
      mapZoomOffY = Math.max(0, Math.min(wrapH - scaledH, my - contentY * z1));
      nextScrollTop = 0;
    } else {
      sizerH = scaledH;
      mapZoomOffY = 0;
      nextScrollTop = contentY * z1 - my;
    }

    mapSizer.style.width = sizerW + 'px';
    mapSizer.style.height = sizerH + 'px';
    mapPlane.style.transform = 'scale(' + z1 + ')';
    mapPlane.style.left = mapZoomOffX + 'px';
    mapPlane.style.top = mapZoomOffY + 'px';
    // Layout must settle before scroll range is valid (zoom-in/out).
    void mapSizer.offsetWidth;
    mapWrap.scrollLeft = nextScrollLeft;
    mapWrap.scrollTop = nextScrollTop;
  }

  if (mapSizer && mapPlane) {
    applyMapZoom(1, null, null, true);
  }

  mapWrap?.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    const pixels = ev.deltaMode === 1 ? ev.deltaY * 16 : ev.deltaMode === 2 ? ev.deltaY * mapWrap.clientHeight : ev.deltaY;
    const factor = Math.exp(-pixels * 0.0018);
    applyMapZoom(mapZoom * factor, ev.clientX, ev.clientY);
  }, { passive: false });

  mapWrap?.addEventListener('click', (ev) => {
    if (mapDidPan) {
      mapDidPan = false;
      return;
    }
    if (ev.target.closest('.node')) return;
    if (ev.target.closest('button[data-act="travel-to"]')) return;
    if (ui.characterOpen) setCharacterOpen(false);
    if (ui.optionsOpen) setOptionsOpen(false);
    if (ui.upgradesOpen) setUpgradesOpen(false);
    closeHelpPops();
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
      if (r.ok) ui.lastMsg = r.stopped ? 'stopped' : `re-routed → ${locName(locId)}`;
      else if (r.reason === 'capacity_gate') {
        ui.lastMsg = r.message || areaBridgeBlockReason(state, state.locationId, locId) || 'Need Capacity Lv1 to cross Exit Ash ↔ Mist Spur';
      } else ui.lastMsg = `cannot re-route (${r.reason})`;
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
    if (r.ok) {
      const fg = r.freight | 0;
      ui.lastMsg = fg > 0
        ? `departing → ${locName(locId)} (−${fg}g freight)`
        : `departing → ${locName(locId)}`;
    } else if (r.reason === 'capacity_gate') {
      ui.lastMsg = r.message || areaBridgeBlockReason(state, state.locationId, locId) || 'Need Capacity Lv1 to cross Exit Ash ↔ Mist Spur';
    } else if (r.reason === 'freight') {
      ui.lastMsg = r.message || 'not enough gold for freight';
    } else ui.lastMsg = `cannot travel (${r.reason})`;
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
      const stackPick =
        row?.querySelector(`select[data-stack-pick="${good}"]`) ||
        row?.querySelector(`input[data-stack-pick="${good}"]`);
      const stackId = stackPick?.value || null;
      if (act === 'sell-all') {
        if (stackId) {
          n = findStack(state.cargoStacks, stackId)?.qty || 0;
        } else {
          n = stacksQtyOf(state.cargoStacks, good);
        }
      }
      // sell-all without stackId sells FIFO across all price stacks of that good
      const r = trySell(state, loc, good, n, act === 'sell-all' && !stackId ? undefined : stackId || undefined);
      const sold = r.sold != null ? r.sold : n;
      if (r.ok) {
        const taxBit = r.tax > 0 ? ` (−${r.tax} A2 toll)` : '';
        ui.lastMsg = `sold ${goodName(good)} ×${sold}${taxBit}`;
      } else ui.lastMsg = `sell failed (${r.reason})`;
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
      ui.lastMsg = r.universalCourier
        ? `unlocked ${locName(unlock.target)} · universal courier routes unlocked`
        : `unlocked ${locName(unlock.target)}`;
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
      const loc = add.dataset.loc;
      if (!courierLocAllowed(state, loc)) {
        ui.lastMsg = 'add failed (locked)';
        render(state, ui);
        return;
      }
      route.push(loc);
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
      const btn = goodToC || goodToP;
      const good = btn.dataset.good;
      const stackId = btn.dataset.stackId || null;
      const input = stackId
        ? document.querySelector(`input[data-xfer-stack="${stackId}"]`)
        : document.querySelector(`input[data-xfer-good="${good}"]`);
      const qty = Number(input?.value || 1);
      const r = tryTransferGood(state, good, goodToC ? 'toCourier' : 'toPlayer', qty, stackId || undefined);
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
      ui.warehouseSel = null;
      render(state, ui);
      return;
    }
    if (tabC) {
      ui.warehouseWho = 'courier';
      ui.warehouseSel = null;
      render(state, ui);
      return;
    }
    // Slice AF — click icon tile to select stack (actions in shared bar)
    const tile = ev.target.closest('#warehouse-list .inv-stack[data-stack-id]');
    if (tile && !ev.target.closest('button')) {
      const stackId = tile.dataset.stackId;
      const side = tile.dataset.side === 'wh' ? 'wh' : 'bag';
      const same =
        ui.warehouseSel &&
        ui.warehouseSel.stackId === stackId &&
        ui.warehouseSel.side === side;
      ui.warehouseSel = same ? null : { stackId, side, goodId: tile.dataset.good };
      render(state, ui);
      return;
    }
    const dep = ev.target.closest('button[data-act="wh-deposit"]');
    const wit = ev.target.closest('button[data-act="wh-withdraw"]');
    if (!dep && !wit) return;
    const btn = dep || wit;
    const good = btn.dataset.good;
    const stackId = btn.dataset.stackId || null;
    const mode = btn.dataset.mode || 'qty';
    const who = ui.warehouseWho === 'courier' ? 'courier' : 'player';
    const bag = who === 'courier' ? state.courier : state;
    if (!bag) {
      ui.lastMsg = 'warehouse failed (no_courier)';
      render(state, ui);
      return;
    }
    const bagStacks = who === 'courier' ? (state.courier?.cargoStacks || []) : (state.cargoStacks || []);
    let qty = 0;
    if (dep) {
      const st = stackId ? findStack(bagStacks, stackId) : null;
      const have = st ? (st.qty | 0) : stacksQtyOf(bagStacks, good);
      if (mode === 'all') {
        qty = have;
        const w = goodWeightG(good);
        if (w > 0) {
          const hubKey = warehouseKeyAtPlayer(state) || 'area1';
          const freeWh = Math.max(0, WAREHOUSE_CAP - warehouseUsed(state, hubKey));
          qty = Math.min(qty, Math.floor(freeWh / w));
        }
      } else {
        const input = stackId
          ? document.querySelector(`input[data-wh-stack-qty="${stackId}"]`)
          : document.querySelector(`input[data-wh-qty="${good}"]`);
        qty = Number(input?.value || 1);
      }
      const r = tryWarehouseDeposit(state, who, good, qty, stackId || undefined);
      ui.lastMsg = r.ok
        ? `deposited ${goodName(good)} ×${qty} → warehouse`
        : `deposit failed (${r.reason})`;
      if (r.ok) { saveGame(state); invalidateQuotes(); }
      render(state, ui);
      return;
    }
    if (wit) {
      const hubKeyW = warehouseKeyAtPlayer(state) || 'area1';
      const whStacks = ensureWarehouse(state, hubKeyW).stacks || [];
      const st = stackId ? findStack(whStacks, stackId) : null;
      const whHave = st ? (st.qty | 0) : stacksQtyOf(whStacks, good);
      if (mode === 'max') {
        const w = goodWeightG(good);
        const used = who === 'courier' ? courierCargoUsed(state.courier) : cargoUsed(state);
        const cap = who === 'courier' ? state.courier.capacity : state.capacity;
        const free = Math.max(0, cap - used);
        qty = w > 0 ? Math.min(whHave, Math.floor(free / w)) : 0;
      } else {
        const input = stackId
          ? document.querySelector(`input[data-wh-stack-qty="${stackId}"]`)
          : document.querySelector(`input[data-wh-qty="${good}"]`);
        qty = Number(input?.value || 1);
      }
      const r = tryWarehouseWithdraw(state, who, good, qty, stackId || undefined);
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
      ui.lastMsg = r.midTravelApplied
        ? `speed upgraded to lv${r.level} (spd ${r.speed}) −${r.cost}G · ETA recalced`
        : `speed upgraded to lv${r.level} (spd ${r.speed}) −${r.cost}G`;
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
    } else if (btn.dataset.act === 'load') {
      // Soft reload — main.js re-reads localStorage via loadGame
      if (!confirm('Load last save? Unsaved progress in this session will be discarded.')) return;
      location.reload();
      return;
    } else if (btn.dataset.act === 'export-save') {
      try {
        const payload = serialize(state);
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'saikoro-save.json';
        a.click();
        URL.revokeObjectURL(url);
        ui.lastMsg = 'save exported';
      } catch {
        ui.lastMsg = 'export failed';
      }
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
