import { LOCATIONS, EDGES, locName, neighborsOf, travelMsBetween } from './map-data.js';
import { GOODS, UNLOCK_LOC3 } from './economy-data.js';
import { getLastSavedAt } from './saving.js';
import { cargoUsed, isTraveling } from './state.js';

/** @type {HTMLElement | null} */
let trainEl = null;

/** Persist qty across quote rebuilds. */
/** @type {Record<string, string>} */
const qtyByGood = {};

/** Last quote table signature — skip rebuild when unchanged. */
let lastQuoteSig = '';

export function mountView() {
  const railsEl = document.getElementById('rails');
  const nodesEl = document.getElementById('nodes');
  trainEl = document.getElementById('train-marker');

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
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'node';
      btn.dataset.locId = loc.id;
      btn.style.left = loc.x + 'px';
      btn.style.top = loc.y + 'px';
      btn.title = loc.id;
      btn.innerHTML = `<span class="node-name">${loc.name}</span>`;
      nodesEl.appendChild(btn);
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
  const parts = [quoteLoc, atStation ? '1' : '0', s.gold];
  for (const g of GOODS) {
    parts.push(g.id, String(s.prices[quoteLoc]?.[g.id] ?? ''), String(s.cargo[g.id] || 0));
  }
  parts.push(s.unlocked.join(','));
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
    tr.innerHTML = `
      <td title="${g.id}">${g.name}</td>
      <td class="num">${price}</td>
      <td class="num">${s.cargo[g.id] || 0}</td>
      <td class="actions">
        <button type="button" data-act="buy" data-good="${g.id}" data-loc="${quoteLoc}" ${atStation ? '' : 'disabled'}>buy</button>
        <button type="button" data-act="buy-max" data-good="${g.id}" data-loc="${quoteLoc}" ${atStation ? '' : 'disabled'}>max</button>
        <input type="number" min="1" value="${qtyVal}" data-qty="${g.id}" class="qty" ${atStation ? '' : 'disabled'} />
        <button type="button" data-act="sell" data-good="${g.id}" data-loc="${quoteLoc}" ${atStation ? '' : 'disabled'}>sell</button>
        <button type="button" data-act="sell-all" data-good="${g.id}" data-loc="${quoteLoc}" ${atStation ? '' : 'disabled'}>all</button>
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
  setText('hud-gold', String(s.gold));
  setText('hud-cargo', `${cargoUsed(s)} / ${s.capacity}`);
  const here = LOCATIONS.find((l) => l.id === s.locationId);
  const travelLabel = s.travel
    ? `moving → ${locName(s.travel.to)} (${Math.min(100, Math.round((s.travel.elapsedMs / s.travel.durationMs) * 100))}%)`
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
    el.disabled = false;
    el.setAttribute("aria-disabled", unlocked ? "false" : "true");
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

  if (trainEl) {
    let x;
    let y;
    if (s.travel) {
      const from = LOCATIONS.find((l) => l.id === s.travel.from);
      const to = LOCATIONS.find((l) => l.id === s.travel.to);
      const t = Math.min(1, s.travel.elapsedMs / s.travel.durationMs);
      x = from.x + (to.x - from.x) * t;
      y = from.y + (to.y - from.y) * t;
    } else {
      const loc = LOCATIONS.find((l) => l.id === s.locationId);
      x = loc.x;
      y = loc.y;
    }
    trainEl.style.left = x + 'px';
    trainEl.style.top = y + 'px';
    trainEl.hidden = false;
  }

  const sig = quoteSignature(s);
  if (sig !== lastQuoteSig) {
    lastQuoteSig = sig;
    renderQuotes(s);
  }

  const destList = document.getElementById('dest-list');
  const destEmpty = document.getElementById('dest-empty');
  const destPanel = document.getElementById('dest-panel');
  if (destList && destPanel) {
    if (s.travel) {
      destPanel.hidden = true;
    } else {
      destPanel.hidden = false;
      const neigh = neighborsOf(s.locationId).filter((id) => s.unlocked.includes(id));
      destList.innerHTML = neigh
        .map((id) => {
          const ms = travelMsBetween(s.locationId, id) || 0;
          const sec = Math.round(ms / 1000);
          return `<li><button type="button" data-act="go" data-loc="${id}">${locName(id)} <span class="eta">${sec}s</span></button></li>`;
        })
        .join('');
      if (destEmpty) destEmpty.hidden = neigh.length > 0;
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
      return n > 0 ? `<li title="${g.id}">${g.name} ×${n}</li>` : '';
    }).filter(Boolean);
    cargoList.innerHTML = rows.join('');
    if (cargoEmpty) cargoEmpty.hidden = rows.length > 0;
  }

  const travelPanel = document.getElementById('travel-panel');
  if (travelPanel) {
    if (s.travel) {
      travelPanel.hidden = false;
      const pct = Math.min(100, Math.round((s.travel.elapsedMs / s.travel.durationMs) * 100));
      setText('travel-route', `${locName(s.travel.from)} → ${locName(s.travel.to)}`);
      const fill = document.getElementById('travel-bar-fill');
      if (fill) fill.style.width = pct + '%';
      setText('travel-pct', pct + '%');
    } else {
      travelPanel.hidden = true;
      const fill = document.getElementById('travel-bar-fill');
      if (fill) fill.style.width = '0%';
    }
  }

  if (ui.lastMsg) setText('toast', ui.lastMsg);
}

/** Force quote rebuild next render (after external qty-affecting actions). */
export function invalidateQuotes() {
  lastQuoteSig = '';
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}
