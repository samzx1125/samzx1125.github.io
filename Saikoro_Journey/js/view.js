import { LOCATIONS, EDGES, locName, neighborsOf, travelMsBetween, formatEta } from './map-data.js?v=z1-20261028r';
import { GOODS, UNLOCK_LOC3, STOP_REROUTE_UNLOCKED } from './economy-data.js?v=z1-20261028r';
import { getLastSavedAt } from './saving.js?v=z1-20261028r';
import { cargoUsed, isTraveling, effectiveBuyAvg } from './state.js?v=z1-20261028r';

/** @type {HTMLElement | null} */
let trainEl = null;
let travelRectEl = null;

/** Persist qty across quote rebuilds. */
/** @type {Record<string, string>} */
const qtyByGood = {};

/** Last quote table signature — skip rebuild when unchanged. */
let lastQuoteSig = '';
/** Last dest-list signature — skip rebuild so :active can stick on go buttons. */
let lastDestSig = '';
/** @type {ReturnType<typeof setTimeout> | null} */
let toastTimer = null;
let lastToastText = '';
/** @type {string | null} */
let pendingFocusGood = null;
/** @type {string | null} */
let pendingTradeFlash = null;
/** @type {number | null} */
let lastRenderedGold = null;

export function focusQtyAfterTrade(goodId) {
  pendingFocusGood = goodId;
}

/** Brief quote-row flash after a successful buy/sell. */
export function flashTradedRow(goodId) {
  pendingTradeFlash = goodId;
}

/** Brief map flash when a location unlocks. */
export function flashUnlockedNode(locId) {
  const el = document.querySelector(`.node[data-loc-id="${locId}"]`);
  if (!el) return;
  el.classList.remove('just-unlocked');
  // reflow so animation retriggers
  void el.offsetWidth;
  el.classList.add('just-unlocked');
  setTimeout(() => el.classList.remove('just-unlocked'), 1000);
}

export function mountView() {
  document.addEventListener('sj-toast-clear', () => {
    lastToastText = '';
    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
  });

  const railsEl = document.getElementById('rails');
  const nodesEl = document.getElementById('nodes');
  trainEl = document.getElementById('train-marker');
  travelRectEl = document.getElementById('travel-rect');

  if (railsEl) {
    railsEl.innerHTML = '';
    for (const e of EDGES) {
      const la = LOCATIONS.find((l) => l.id === e.a);
      const lb = LOCATIONS.find((l) => l.id === e.b);
      if (!la || !lb) continue;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', String(la.x));
      line.setAttribute('y1', String(la.y));
      line.setAttribute('x2', String(lb.x));
      line.setAttribute('y2', String(lb.y));
      line.setAttribute('class', 'rail');
      line.dataset.a = e.a;
      line.dataset.b = e.b;
      railsEl.appendChild(line);
    }
  }

  if (nodesEl) {
    nodesEl.innerHTML = '';
    for (const loc of LOCATIONS) {
      const wrap = document.createElement('div');
      wrap.className = 'node-wrap';
      wrap.dataset.locId = loc.id;
      wrap.style.left = loc.x + 'px';
      wrap.style.top = loc.y + 'px';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'node';
      btn.dataset.locId = loc.id;
      btn.title = loc.id;
      // Default out of tab order until first render sets unlocked state
      btn.tabIndex = -1;
      btn.disabled = true;
      btn.setAttribute('aria-disabled', 'true');
      btn.classList.add('locked');
      btn.innerHTML = `<span class="node-name">${loc.name}</span>`;

      const travel = document.createElement('button');
      travel.type = 'button';
      travel.className = 'map-travel primary';
      travel.dataset.act = 'travel-to';
      travel.dataset.loc = loc.id;
      travel.textContent = 'Travel';
      travel.hidden = true;
      travel.disabled = true;

      wrap.appendChild(btn);
      wrap.appendChild(travel);
      nodesEl.appendChild(wrap);
    }
  }
}

function captureQtyInputs() {
  document.querySelectorAll('input.qty[data-qty]').forEach((el) => {
    const id = el.getAttribute('data-qty');
    if (id) qtyByGood[id] = el.value;
  });
}

/**
 * @param {import('./state.js').GameState} s
 */
function quoteSignature(s) {
  const quoteLoc = s.selectedLocId || s.locationId;
  const atStation = !isTraveling(s) && s.locationId === quoteLoc && s.unlocked.includes(quoteLoc);
  const parts = [quoteLoc, s.locationId, atStation ? '1' : '0', s.gold];
  for (const g of GOODS) {
    const avg = effectiveBuyAvg(s, g.id);
    parts.push(
      g.id,
      String(s.prices[quoteLoc]?.[g.id] ?? ''),
      String(s.cargo[g.id] || 0),
      avg == null ? '' : avg.toFixed(2),
    );
  }
  parts.push(s.unlocked.join(','));
  return parts.join('|');
}

/**
 * Dest list content signature — location, travel flag, neighbor ids + etas.
 * @param {import('./state.js').GameState} s
 */
function destSignature(s) {
  if (s.travel) {
    const parts = ['traveling', s.travel.from + '>' + s.travel.to, STOP_REROUTE_UNLOCKED ? 'rr1' : 'rr0'];
    if (STOP_REROUTE_UNLOCKED) {
      const fromId = s.locationId;
      const neigh = neighborsOf(fromId).filter((id) => s.unlocked.includes(id) && id !== s.travel.to);
      for (const id of neigh) {
        const ms = travelMsBetween(fromId, id) || 0;
        parts.push(id, String(Math.round(ms / 1000)));
      }
    }
    return parts.join('|');
  }
  const neigh = neighborsOf(s.locationId).filter((id) => s.unlocked.includes(id));
  const parts = [s.locationId, 'docked'];
  for (const id of neigh) {
    const ms = travelMsBetween(s.locationId, id) || 0;
    parts.push(id, String(Math.round(ms / 1000)));
  }
  return parts.join('|');
}

/**
 * @param {import('./state.js').GameState} s
 */
function renderQuotes(s) {
  const quoteLoc = s.selectedLocId || s.locationId;
  const quoteLocDef = LOCATIONS.find((l) => l.id === quoteLoc);
  setText('quote-title', quoteLocDef ? quoteLocDef.name : 'quotes');
  const tbody = document.getElementById('quote-body');
  if (!tbody) return;

  captureQtyInputs();
  tbody.innerHTML = '';
  const atStation = !isTraveling(s) && s.locationId === quoteLoc && s.unlocked.includes(quoteLoc);
  for (const g of GOODS) {
    const price = s.prices[quoteLoc]?.[g.id];
    if (price == null) continue;
    const qtyVal = qtyByGood[g.id] != null ? qtyByGood[g.id] : '1';
    const tr = document.createElement('tr');
    tr.dataset.good = g.id;
    const buyAvg = effectiveBuyAvg(s, g.id);
    let deltaHtml = '—';
    let deltaTitle = 'no buy MP yet';
    if (buyAvg != null) {
      const d = price - buyAvg;
      const sign = d > 0 ? '+' : '';
      const avgShown = Number.isInteger(buyAvg) ? String(buyAvg) : buyAvg.toFixed(1);
      deltaHtml = `${sign}${Number.isInteger(d) ? d : d.toFixed(1)}`;
      deltaTitle = `loc MP ${price} vs buy avg ${avgShown}`;
    }
    tr.innerHTML = `
      <td title="${g.id}">${g.name}</td>
      <td class="num">${price}</td>
      <td class="num delta" title="${deltaTitle}">${deltaHtml}</td>
      <td class="num">${s.cargo[g.id] || 0}</td>
      <td class="actions">
        <button type="button" data-act="buy" data-good="${g.id}" data-loc="${quoteLoc}" ${atStation ? '' : 'disabled'}>buy</button>
        <button type="button" data-act="buy-max" data-good="${g.id}" data-loc="${quoteLoc}" ${atStation ? '' : 'disabled'}>Buy max</button>
        <input type="number" min="1" value="${qtyVal}" data-qty="${g.id}" class="qty" ${atStation ? '' : 'disabled'} />
        <button type="button" data-act="sell" data-good="${g.id}" data-loc="${quoteLoc}" ${atStation ? '' : 'disabled'}>sell</button>
        <button type="button" data-act="sell-all" data-good="${g.id}" data-loc="${quoteLoc}" ${atStation ? '' : 'disabled'}>Sell all</button>
      </td>`;
    tbody.appendChild(tr);
  }

  const unlocked3 = s.unlocked.includes(UNLOCK_LOC3.target);
  const unlockPanel = document.getElementById('unlock-panel');
  if (unlockPanel) {
    unlockPanel.hidden = unlocked3;
    const list = unlockPanel.querySelector('.unlock-list');
    if (list) {
      list.innerHTML = UNLOCK_LOC3.costs
        .map((c) => {
          const g = GOODS.find((x) => x.id === c.goodId);
          const have = s.cargo[c.goodId] || 0;
          const ok = have >= c.qty;
          return `<li class="${ok ? 'ok' : ''}" title="${c.goodId}">${g?.name || c.goodId} ${have}/${c.qty}</li>`;
        })
        .join('');
    }
    {
      let need = 0;
      let haveUnits = 0;
      for (const c of UNLOCK_LOC3.costs) {
        need += c.qty;
        haveUnits += Math.min(s.cargo[c.goodId] || 0, c.qty);
      }
      const pct = need ? Math.round((haveUnits / need) * 100) : 0;
      const fill = document.getElementById('unlock-bar-fill');
      if (fill) fill.style.width = (unlocked3 ? 100 : pct) + '%';
      setText('unlock-pct', unlocked3 ? 'done' : `${haveUnits} / ${need}`);
    }
    const btn = unlockPanel.querySelector('[data-act="unlock"]');
    if (btn) {
      const can =
        !isTraveling(s) &&
        !unlocked3 &&
        UNLOCK_LOC3.costs.every((c) => (s.cargo[c.goodId] || 0) >= c.qty);
      btn.disabled = !can;
    }
  }
}

/**
 * @param {import('./state.js').GameState} s
 * @param {{ lastMsg?: string }} ui
 */
export function render(s, ui = {}) {
  const goldEl = document.getElementById('hud-gold');
  if (goldEl) {
    if (lastRenderedGold != null && lastRenderedGold !== s.gold) {
      goldEl.classList.remove('gold-tick');
      void goldEl.offsetWidth;
      goldEl.classList.add('gold-tick');
      setTimeout(() => goldEl.classList.remove('gold-tick'), 500);
    }
    lastRenderedGold = s.gold;
    goldEl.textContent = String(s.gold);
  }
  setText('hud-cargo', `${cargoUsed(s)} / ${s.capacity} g`);
  const cargoBar = document.getElementById('hud-cargo-bar');
  if (cargoBar) {
    const pct = s.capacity ? Math.min(100, Math.round((cargoUsed(s) / s.capacity) * 100)) : 0;
    cargoBar.style.width = pct + '%';
  }
  const here = LOCATIONS.find((l) => l.id === s.locationId);
  const travelLabel = s.travel
    ? (() => {
        const pct = Math.min(100, Math.round((s.travel.elapsedMs / s.travel.durationMs) * 100));
        const leftMs = Math.max(0, s.travel.durationMs - s.travel.elapsedMs);
        return `moving → ${locName(s.travel.to)} (${pct}% · ${formatEta(leftMs)})`;
      })()
    : here
      ? here.name
      : s.locationId;
  setText('hud-loc', travelLabel);

  document.querySelectorAll('.node').forEach((el) => {
    const id = el.dataset.locId;
    const unlocked = s.unlocked.includes(id);
    el.classList.toggle('locked', !unlocked);
    el.classList.toggle('current', !s.travel && id === s.locationId);
    el.classList.toggle('selected', id === s.selectedLocId);
    el.classList.toggle('dest', !!s.travel && id === s.travel.to);
    // Locked: disabled + tabindex=-1 so Tab skips (aria-disabled alone is not enough)
    el.disabled = !unlocked;
    el.tabIndex = unlocked ? 0 : -1;
    el.setAttribute('tabindex', unlocked ? '0' : '-1');
    el.setAttribute('aria-disabled', unlocked ? 'false' : 'true');
  });

  document.querySelectorAll('.rail').forEach((line) => {
    const a = line.dataset.a;
    const b = line.dataset.b;
    const active =
      s.travel &&
      ((s.travel.from === a && s.travel.to === b) || (s.travel.from === b && s.travel.to === a));
    line.classList.toggle('active', !!active);
    const bothUnlocked = s.unlocked.includes(a) && s.unlocked.includes(b);
    line.classList.toggle('locked', !bothUnlocked);
  });

  {
    let x;
    let y;
    if (s.travel) {
      const from = LOCATIONS.find((l) => l.id === s.travel.from);
      const to = LOCATIONS.find((l) => l.id === s.travel.to);
      const tt = Math.min(1, s.travel.elapsedMs / s.travel.durationMs);
      x = from.x + (to.x - from.x) * tt;
      y = from.y + (to.y - from.y) * tt;
    } else {
      const loc = LOCATIONS.find((l) => l.id === s.locationId);
      x = loc.x;
      y = loc.y;
    }
    if (trainEl) {
      trainEl.style.left = x + 'px';
      trainEl.style.top = y + 'px';
      trainEl.hidden = false;
      trainEl.classList.toggle('traveling', !!s.travel);
    }
    if (travelRectEl) {
      if (s.travel) {
        travelRectEl.hidden = false;
        travelRectEl.style.left = x + 'px';
        travelRectEl.style.top = y + 'px';
        const td = s.travel.distance || 0;
        const tr = s.travel.traveledDistance != null ? s.travel.traveledDistance : 0;
        travelRectEl.title = `on train · ${tr.toFixed(0)} / ${td}`;
      } else {
        travelRectEl.hidden = true;
      }
    }
  }

  const sig = quoteSignature(s);
  if (sig !== lastQuoteSig) {
    lastQuoteSig = sig;
    renderQuotes(s);
  }
  if (pendingFocusGood) {
    const el = document.querySelector(`input.qty[data-qty="${pendingFocusGood}"]`);
    pendingFocusGood = null;
    if (el && !el.disabled) {
      // Programmatic focus after Buy/Sell — avoid looking like keyboard focus-visible
      el.focus({ preventScroll: true, focusVisible: false });
      el.select();
    }
  }
  if (pendingTradeFlash) {
    const good = pendingTradeFlash;
    pendingTradeFlash = null;
    const row = document.querySelector(`#quote-body tr[data-good="${good}"]`);
    if (row) {
      row.classList.remove('just-traded');
      void row.offsetWidth;
      row.classList.add('just-traded');
      setTimeout(() => row.classList.remove('just-traded'), 600);
    }
  }

  const destList = document.getElementById('dest-list');
  const destEmpty = document.getElementById('dest-empty');
  const destPanel = document.getElementById('dest-panel');
  if (destList && destPanel) {
    const dsig = destSignature(s);
    if (s.travel && !STOP_REROUTE_UNLOCKED) {
      destPanel.hidden = true;
      if (dsig !== lastDestSig) {
        lastDestSig = dsig;
        destList.innerHTML = '';
        if (destEmpty) destEmpty.hidden = true;
      }
    } else if (s.travel && STOP_REROUTE_UNLOCKED) {
      destPanel.hidden = false;
      if (dsig !== lastDestSig) {
        lastDestSig = dsig;
        const fromId = s.locationId;
        const neigh = neighborsOf(fromId).filter((id) => s.unlocked.includes(id) && id !== s.travel.to);
        destList.innerHTML = neigh
          .map((id) => {
            const ms = travelMsBetween(fromId, id) || 0;
            return `<li><button type="button" data-act="go" data-loc="${id}">Re-route ${locName(id)} <span class="eta">${formatEta(ms)}</span></button></li>`;
          })
          .join('');
        // also allow stop via going "home" listed? Stop button handles abort
        if (destEmpty) destEmpty.hidden = neigh.length > 0;
      }
    } else {
      destPanel.hidden = false;
      if (dsig !== lastDestSig) {
        lastDestSig = dsig;
        const neigh = neighborsOf(s.locationId).filter((id) => s.unlocked.includes(id));
        destList.innerHTML = neigh
          .map((id) => {
            const ms = travelMsBetween(s.locationId, id) || 0;
            return `<li><button type="button" data-act="go" data-loc="${id}">${locName(id)} <span class="eta">${formatEta(ms)}</span></button></li>`;
          })
          .join('');
        if (destEmpty) destEmpty.hidden = neigh.length > 0;
      }
    }
  }

  const stamp = document.getElementById('save-stamp');
  if (stamp) {
    const t = getLastSavedAt();
    if (t == null) stamp.textContent = 'never saved';
    else {
      const d = new Date(t);
      stamp.textContent = 'last saved ' + d.toLocaleString();
    }
  }

  const cargoList = document.getElementById('cargo-list');
  const cargoEmpty = document.getElementById('cargo-empty');
  if (cargoList) {
    const rows = GOODS.map((g) => {
      const n = s.cargo[g.id] || 0;
      if (n <= 0) return '';
      const lineG = n * (g.weightG || 0);
      return `<li title="${g.id} · ${g.weightG}g each">${g.name} ×${n} <span class="muted">(${lineG}g)</span></li>`;
    }).filter(Boolean);
    cargoList.innerHTML = rows.join('');
    if (cargoEmpty) cargoEmpty.hidden = rows.length > 0;
  }

  const travelPanel = document.getElementById('travel-panel');
  if (travelPanel) {
    if (s.travel) {
      travelPanel.hidden = false;
      const pct = Math.min(100, Math.round((s.travel.elapsedMs / s.travel.durationMs) * 100));
      const leftMs = Math.max(0, s.travel.durationMs - s.travel.elapsedMs);
      const td = s.travel.distance || 0;
      const tr = s.travel.traveledDistance != null ? s.travel.traveledDistance : 0;
      const spd = s.travel.speed || 0;
      setText('travel-route', `${locName(s.travel.from)} → ${locName(s.travel.to)} · ${td} @${spd}`);
      const fill = document.getElementById('travel-bar-fill');
      if (fill) fill.style.width = pct + '%';
      setText('travel-pct', `${pct}% · ETA ${formatEta(leftMs)} · ${tr.toFixed(0)}/${td}`);
      const stopBtn = document.getElementById('btn-stop-travel');
      if (stopBtn) {
        stopBtn.disabled = !STOP_REROUTE_UNLOCKED;
        stopBtn.title = STOP_REROUTE_UNLOCKED ? 'Stop mid-travel' : 'Locked until unlock';
      }
      setText(
        'stop-reroute-hint',
        STOP_REROUTE_UNLOCKED
          ? 'Stop aborts to origin · Destinations re-route'
          : 'Stop / re-route locked until unlock.',
      );
    } else {
      travelPanel.hidden = true;
      const fill = document.getElementById('travel-bar-fill');
      if (fill) fill.style.width = '0%';
    }
  }

  // Travel to / Travel (panel + map under chip) — same action, Slice D
  {
    const panelOpen = ui.panelOpen !== false;
    const target = s.selectedLocId || s.locationId;
    const name = locName(target);
    const here = target === s.locationId;
    const unlocked = s.unlocked.includes(target);
    const adjacent = !here && neighborsOf(s.locationId).includes(target);
    const can = !s.travel && unlocked && adjacent;
    let hint = '';
    if (s.travel) hint = 'traveling…';
    else if (here) hint = 'you are here';
    else if (!unlocked) hint = 'location locked';
    else if (!adjacent) hint = 'only adjacent locations';
    else hint = `depart → ${name}`;
    for (const id of ['btn-travel-to', 'btn-travel']) {
      const btn = document.getElementById(id);
      if (!btn) continue;
      btn.disabled = !can;
      if (id === 'btn-travel-to') btn.textContent = here ? 'Travel to' : `Travel to ${name}`;
      else btn.textContent = 'Travel';
    }
    setText('loc-travel-hint', hint);
    setText('station-travel-hint', hint);

    document.querySelectorAll('.map-travel').forEach((btn) => {
      const locId = btn.dataset.loc;
      const show = panelOpen && !!s.selectedLocId && locId === s.selectedLocId && !s.travel;
      btn.hidden = !show;
      if (!show) {
        btn.disabled = true;
        return;
      }
      const thisCan =
        s.unlocked.includes(locId) &&
        locId !== s.locationId &&
        neighborsOf(s.locationId).includes(locId);
      btn.disabled = !thisCan;
      btn.textContent = 'Travel';
      btn.title = thisCan ? `Travel to ${locName(locId)}` : hint;
    });
  }

  // Station panels (quotes + unlock): Esc / blank map closes; node click reopens
  {
    const panelOpen = ui.panelOpen !== false;
    const quotePanel = document.getElementById('quote-panel');
    if (quotePanel) quotePanel.hidden = !panelOpen;
    const unlockPanel = document.getElementById('unlock-panel');
    if (unlockPanel) {
      const unlocked3 = s.unlocked.includes(UNLOCK_LOC3.target);
      unlockPanel.hidden = unlocked3 || !panelOpen;
    }
  }

  if (ui.lastMsg && ui.lastMsg !== lastToastText) {
    lastToastText = ui.lastMsg;
    const toast = document.getElementById('toast');
    if (toast) {
      toast.textContent = ui.lastMsg;
      toast.classList.remove('fade');
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        toast.classList.add('fade');
      }, 3500);
    }
  }
}

/** Force quote rebuild next render (after external qty-affecting actions). */
export function invalidateQuotes() {
  lastQuoteSig = '';
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}
