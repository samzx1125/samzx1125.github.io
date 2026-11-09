import { LOCATIONS, EDGES, locName, neighborsOf, travelMsBetween, formatEta, areaOfLoc, zoneOfLoc } from './map-data.js?v=z1-20261028bi';
import { courierLocAllowed } from './engine.js?v=z1-20261028bi';
import { GOODS, availableUnlocks, STOP_REROUTE_UNLOCKED, depleteRateForGood, sellMulFromCondition, TRANSPORT_QUESTS, goodName, goodWeightG, goodIcon, goodDescription, COURIER_UNLOCK_LOC, CAPACITY_MAX_LEVEL, capacityUpgradeCost, effectiveCapacity, PRESERVE_MAX_LEVEL, preserveUpgradeCost, preserveDrainFactor, SPEED_MAX_LEVEL, speedUpgradeCost, effectiveSpeed, AREA1_WAREHOUSE_CAP, AREA1_WAREHOUSE_LOC, AREA2_WAREHOUSE_LOC, WAREHOUSE_CAP, areaPropertyForLoc, areaBridgeBlockReason, AREA_BRIDGE_A, AREA_BRIDGE_B, AREA_PROPERTIES, travelFreightCost } from './economy-data.js?v=z1-20261028bi';
import { PERSONAL_DEFS, personalName, personalIcon, personalDescription } from './personal-data.js?v=z1-20261028bi';
import { BODY_GLYPH } from './opening.js?v=z1-20261028bi';
import { getLastSavedAt } from './saving.js?v=z1-20261028bi';
import { cargoUsed, isTraveling, effectiveBuyAvg, goodCondition, courierCargoUsed, courierGoodCondition, courierCoLocated, warehouseUsed, warehouseGoodCondition, playerAtWarehouse, courierAtWarehouse, ensureWarehouse, warehouseKeyAtPlayer, stacksQtyOf, findStack } from './state.js?v=z1-20261028bi';

/** @type {HTMLElement | null} */
let trainEl = null;
let travelRectEl = null;
/** @type {HTMLElement | null} */
let courierEl = null;
let lastCourierPanelSig = '';
let lastTransferSig = '';
let lastWarehouseSig = '';

/** Persist qty across quote rebuilds. */
/** @type {Record<string, string>} */
const qtyByGood = {};

/** Last quote table signature — skip rebuild when unchanged. */
let lastQuoteSig = '';
/** Last dest-list signature — skip rebuild so :active can stick on go buttons. */
let lastDestSig = '';
/** Last cargo-list signature — skip rebuild so Options click-outside sees inventory clicks. */
let lastCargoSig = '';
let lastPersonalSig = '';
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

/** Slice AU — locs shown on map: unlocked + current availableUnlock targets only. */
function mapVisibleLocIds(s) {
  const vis = new Set(s.unlocked || []);
  for (const u of availableUnlocks(s.unlocked)) {
    if (u && u.target) vis.add(u.target);
  }
  return vis;
}

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
  courierEl = document.getElementById('courier-marker');

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
      line.setAttribute('class', 'rail map-hidden');
      line.dataset.a = e.a;
      line.dataset.b = e.b;
      railsEl.appendChild(line);
    }
  }

  if (nodesEl) {
    nodesEl.innerHTML = '';
    for (const loc of LOCATIONS) {
      const wrap = document.createElement('div');
      wrap.className = 'node-wrap map-hidden';
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

  // Slice AS — static Area climate labels (once); pointer-events none via CSS
  const labelsEl = document.getElementById('map-area-labels');
  if (labelsEl) {
    labelsEl.innerHTML = '';
    for (const areaId of Object.keys(AREA_PROPERTIES).map(Number).sort((a, b) => a - b)) {
      const prop = AREA_PROPERTIES[areaId];
      if (!prop || !prop.climate) continue;
      const locs = LOCATIONS.filter((l) => areaOfLoc(l.id) === areaId);
      if (!locs.length) continue;
      const cx = locs.reduce((s, l) => s + l.x, 0) / locs.length;
      // Sit above the node band (~150–280) so chips stay readable
      const cy = 52;
      const el = document.createElement('div');
      el.className = 'map-area-label map-hidden';
      el.dataset.areaId = String(areaId);
      el.style.left = Math.round(cx) + 'px';
      el.style.top = cy + 'px';
      el.textContent = `A${areaId} ${prop.climate}`;
      labelsEl.appendChild(el);
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
  const mem = !atStation ? s.visitedPrices?.[quoteLoc] : null;
  const parts = [quoteLoc, s.locationId, atStation ? '1' : '0', mem ? 'mem' : 'live', s.gold];
  for (const g of GOODS) {
    const avg = effectiveBuyAvg(s, g.id);
    const have = stacksQtyOf(s.cargoStacks, g.id);
    const cond =
      have > 0 && depleteRateForGood(g.id) > 0
        ? Math.round(goodCondition(s, g.id))
        : '';
    const shown = atStation
      ? s.prices[quoteLoc]?.[g.id]
      : mem?.[g.id];
    parts.push(
      g.id,
      String(shown ?? ''),
      String(have),
      avg == null ? '' : avg.toFixed(2),
      String(cond),
    );
  }
  // include stack unit prices so split stacks refresh quotes
  for (const st of s.cargoStacks || []) {
    if (!st) continue;
    parts.push(st.id, String(st.unitPrice), String(st.qty));
  }
  parts.push(s.unlocked.join(','));
  return parts.join('|');
}

/**
 * Dest list content signature — location, travel flag, neighbor ids + etas.
 * @param {import('./state.js').GameState} s
 */
function destSignature(s) {
  const spd = effectiveSpeed(s.speedLevel);
  // Include capacityLevel so AO bridge gate re-enables dest rows after upgrade (Slice AP).
  const capPart = `cap${s.capacityLevel | 0}`;
  if (s.travel) {
    const parts = ['traveling', s.travel.from + '>' + s.travel.to, STOP_REROUTE_UNLOCKED ? 'rr1' : 'rr0', `spd${s.speedLevel|0}`, capPart];
    if (STOP_REROUTE_UNLOCKED) {
      const fromId = s.locationId;
      const neigh = neighborsOf(fromId).filter((id) => s.unlocked.includes(id) && id !== s.travel.to);
      for (const id of neigh) {
        const ms = travelMsBetween(fromId, id, spd) || 0;
        const gated = areaBridgeBlockReason(s, fromId, id) ? '1' : '0';
        parts.push(id, String(Math.round(ms / 1000)), gated);
      }
    }
    return parts.join('|');
  }
  const neigh = neighborsOf(s.locationId).filter((id) => s.unlocked.includes(id));
  const parts = [s.locationId, 'docked', `spd${s.speedLevel|0}`, capPart];
  for (const id of neigh) {
    const ms = travelMsBetween(s.locationId, id, spd) || 0;
    const gated = areaBridgeBlockReason(s, s.locationId, id) ? '1' : '0';
    parts.push(id, String(Math.round(ms / 1000)), gated);
  }
  return parts.join('|');
}

/**
 * Slice AP — Destinations row HTML; soft-gate Exit Ash↔Mist Spur via areaBridgeBlockReason.
 * Slice AT — show body-train freight gold next to ETA (fresh depart only; re-route uncharged).
 * @param {import('./state.js').GameState} s
 * @param {string} fromId
 * @param {string} id
 * @param {number} ms
 * @param {boolean} reroute
 */
function destGoButtonHtml(s, fromId, id, ms, reroute) {
  const bridgeMsg = areaBridgeBlockReason(s, fromId, id);
  const label = reroute ? `Re-route ${locName(id)}` : locName(id);
  const freight = reroute ? 0 : (travelFreightCost(fromId, id) || 0);
  const etaBits = freight > 0 ? `${formatEta(ms)} · ${freight}g` : formatEta(ms);
  if (bridgeMsg) {
    return (
      `<li><button type="button" class="dest-gated" data-act="go" data-loc="${id}" disabled ` +
      `title="${bridgeMsg}" aria-label="${bridgeMsg}">${label} <span class="eta">${etaBits}</span></button></li>`
    );
  }
  // Soft-disable when gold < freight on fresh depart
  if (!reroute && freight > 0 && (s.gold | 0) < freight) {
    const msg = `Need ${freight}g freight (have ${s.gold | 0}g)`;
    return (
      `<li><button type="button" class="dest-gated" data-act="go" data-loc="${id}" disabled ` +
      `title="${msg}" aria-label="${msg}">${label} <span class="eta">${etaBits}</span></button></li>`
    );
  }
  const tip = freight > 0 ? `${label} · ${freight}g freight` : label;
  return (
    `<li><button type="button" data-act="go" data-loc="${id}" title="${tip}">` +
    `${label} <span class="eta">${etaBits}</span></button></li>`
  );
}

/**
 * Cargo-list signature — qty + weight per good with stock.
 * @param {import('./state.js').GameState} s
 */
function cargoSignature(s) {
  const parts = [];
  for (const st of s.cargoStacks || []) {
    if (!st || !(st.qty > 0)) continue;
    const c = depleteRateForGood(st.goodId) > 0 ? Math.round(st.condition ?? 100) : '';
    parts.push(st.id, st.goodId, String(st.qty), String(st.unitPrice), String(c));
  }
  if (s.quest && s.quest.qty > 0) {
    parts.push(
      'quest',
      s.quest.goodId,
      String(s.quest.qty),
      String(Math.round(s.quest.condition ?? 100)),
      s.quest.to,
    );
  }
  return parts.join('|') || 'empty';
}


/**
 * Personal-list signature — qty per held personal id.
 * @param {import('./state.js').GameState} s
 */

/** Hover title for a trade stack icon. */
function stackHoverTitle(st) {
  const g = GOODS.find((x) => x.id === st.goodId);
  const name = g?.name || st.goodId;
  const desc = g?.description || '';
  const w = g?.weightG || 0;
  const buy = st.unitPrice != null ? ` · buy ${st.unitPrice}G` : '';
  const cond =
    depleteRateForGood(st.goodId) > 0
      ? ` · ${Math.round(st.condition ?? 100)}%`
      : '';
  return `${name} — ${desc}${buy}${cond} · ${w}g each`.trim();
}

function personalSignature(s) {
  const bag = s.personal && typeof s.personal === 'object' ? s.personal : {};
  const parts = [];
  for (const d of PERSONAL_DEFS) {
    const n = bag[d.id] || 0;
    if (n > 0) parts.push(d.id, String(n));
  }
  // include unknown ids so debug grants still show
  for (const id of Object.keys(bag).sort()) {
    if (PERSONAL_DEFS.some((d) => d.id === id)) continue;
    const n = bag[id] || 0;
    if (n > 0) parts.push(id, String(n));
  }
  return parts.join('|') || 'empty';
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
  const memRow = !atStation ? s.visitedPrices?.[quoteLoc] : null;
  const remHint = document.getElementById('quote-mem-hint');
  if (remHint) {
    if (atStation) remHint.textContent = 'Live MP at this station.';
    else if (memRow) remHint.textContent = 'Remembered last-seen MP (not live). Revisit to refresh.';
    else remHint.textContent = 'No price memory — visit this station first.';
  }
  for (const g of GOODS) {
    const live = s.prices[quoteLoc]?.[g.id];
    const mem = memRow?.[g.id];
    // at station: only goods with live MP; remote: show all goods known at base or mem/—
    if (atStation && live == null) continue;
    if (!atStation && live == null && mem == null) {
      // still show if BASE would have had it — check live map keys from any
      // skip goods never listed at this loc
      const ever = s.prices[quoteLoc] && Object.prototype.hasOwnProperty.call(s.prices[quoteLoc], g.id);
      if (!ever && mem == null) continue;
    }
    const price = atStation ? live : mem;
    const qtyVal = qtyByGood[g.id] != null ? qtyByGood[g.id] : '1';
    const tr = document.createElement('tr');
    tr.dataset.good = g.id;
    const buyAvg = effectiveBuyAvg(s, g.id);
    let deltaHtml = '—';
    let deltaTitle = 'no buy MP yet';
    if (price != null && buyAvg != null) {
      const d = price - buyAvg;
      const sign = d > 0 ? '+' : '';
      const avgShown = Number.isInteger(buyAvg) ? String(buyAvg) : buyAvg.toFixed(1);
      deltaHtml = `${sign}${Number.isInteger(d) ? d : d.toFixed(1)}`;
      deltaTitle = atStation
        ? `loc MP ${price} vs buy avg ${avgShown}`
        : `mem MP ${price} vs buy avg ${avgShown}`;
    }
    const have = stacksQtyOf(s.cargoStacks, g.id);
    let priceCell;
    let priceTitle;
    if (price == null) {
      priceCell = '—';
      priceTitle = 'unvisited / no memory';
    } else if (atStation) {
      priceCell = String(price);
      priceTitle = `market ${price}`;
      if (have > 0 && depleteRateForGood(g.id) > 0) {
        const cond = Math.round(goodCondition(s, g.id));
        const mul = sellMulFromCondition(cond);
        const sellAt = Math.max(0, Math.round(price * mul));
        priceCell = `${price}<span class="muted sell-at" title="sell at condition ${cond}%">→${sellAt}</span>`;
        priceTitle = `MP ${price}; sell @ ${sellAt} (${cond}% condition)`;
      }
    } else {
      priceCell = `<span class="mem-price" title="last seen MP">mem ${price}</span>`;
      priceTitle = `remembered MP ${price} (not live)`;
    }
    const nameTitle = `${g.name} — ${g.description || ''}`.replace(/"/g, '&quot;');
    // stack picker for sell (split by unit buy price)
    const stacksOf = (s.cargoStacks || []).filter((st) => st && st.goodId === g.id && st.qty > 0);
    let stackSel = '';
    if (stacksOf.length > 1) {
      stackSel =
        `<select class="stack-pick" data-stack-pick="${g.id}" title="sell from stack">` +
        stacksOf
          .map(
            (st) =>
              `<option value="${st.id}">${st.unitPrice}G ×${st.qty}</option>`,
          )
          .join('') +
        `</select>`;
    } else if (stacksOf.length === 1) {
      stackSel = `<input type="hidden" data-stack-pick="${g.id}" value="${stacksOf[0].id}" />`;
    }
    tr.innerHTML = `
      <td title="${nameTitle}"><span class="inv-icon inline" aria-hidden="true">${g.icon || '□'}</span> ${g.name}</td>
      <td class="num" title="${priceTitle}">${priceCell}</td>
      <td class="num delta" title="${deltaTitle}">${deltaHtml}</td>
      <td class="num">${have}</td>
      <td class="actions">
        <button type="button" data-act="buy" data-good="${g.id}" data-loc="${quoteLoc}" ${atStation ? '' : 'disabled'}>buy</button>
        <button type="button" data-act="buy-max" data-good="${g.id}" data-loc="${quoteLoc}" ${atStation ? '' : 'disabled'}>Buy max</button>
        <input type="number" min="1" value="${qtyVal}" data-qty="${g.id}" class="qty" ${atStation ? '' : 'disabled'} />
        ${stackSel}
        <button type="button" data-act="sell" data-good="${g.id}" data-loc="${quoteLoc}" ${atStation && have > 0 ? '' : 'disabled'}>sell</button>
        <button type="button" data-act="sell-all" data-good="${g.id}" data-loc="${quoteLoc}" ${atStation && have > 0 ? '' : 'disabled'}>Sell all</button>
      </td>`;
    tbody.appendChild(tr);
  }

  // Slice T — data-driven next available unlock(s)
  const unlockPanel = document.getElementById('unlock-panel');
  if (unlockPanel) {
    const offers = availableUnlocks(s.unlocked);
    const traveling = isTraveling(s);
    const offersEl = document.getElementById('unlock-offers');
    if (offersEl) {
      if (!offers.length) {
        offersEl.innerHTML = '';
      } else {
        offersEl.innerHTML = offers
          .map((u) => {
            const deposits = (s.unlockDeposits && s.unlockDeposits[u.target]) || {};
            let need = 0;
            let haveUnits = 0;
            const lis = u.costs
              .map((c) => {
                const g = GOODS.find((x) => x.id === c.goodId);
                const deposited = deposits[c.goodId] || 0;
                const cargo = stacksQtyOf(s.cargoStacks, c.goodId);
                need += c.qty;
                haveUnits += Math.min(deposited, c.qty);
                const ok = deposited >= c.qty;
                const hint =
                  cargo > 0 && deposited < c.qty
                    ? ` <span class="muted">(+${cargo} cargo)</span>`
                    : '';
                return `<li class="${ok ? 'ok' : ''}" title="${c.goodId}">${g?.name || c.goodId} ${deposited}/${c.qty}${hint}</li>`;
              })
              .join('');
            const pct = need ? Math.round((haveUnits / need) * 100) : 0;
            const allReady = u.costs.every((c) => (deposits[c.goodId] || 0) >= c.qty);
            const canHandIn =
              !traveling &&
              u.costs.some((c) => {
                const deposited = deposits[c.goodId] || 0;
                return deposited < c.qty && stacksQtyOf(s.cargoStacks, c.goodId) > 0;
              });
            const can = allReady ? !traveling : canHandIn;
            const name = locName(u.target);
            const btnLabel = allReady ? `Unlock ${name}` : 'Hand in';
            return `<div class="unlock-offer" data-target="${u.target}">
              <h3 class="unlock-offer-title">Unlock ${name}</h3>
              <div class="bar" aria-label="unlock progress"><div class="bar-fill" style="width:${pct}%"></div></div>
              <p class="muted unlock-offer-pct">${haveUnits} / ${need} deposited</p>
              <ul class="unlock-list">${lis}</ul>
              <button type="button" class="primary" data-act="unlock" data-target="${u.target}" ${can ? '' : 'disabled'}>${btnLabel}</button>
            </div>`;
          })
          .join('');
      }
    }
    // visibility also gated by panelOpen in render()
    unlockPanel.dataset.hasOffers = offers.length ? '1' : '0';
  }
}

/**
 * @param {import('./state.js').GameState} s
 * @param {{ lastMsg?: string }} ui
 */
export function render(s, ui = {}) {
  const nameEl = document.getElementById('hud-name');
  if (nameEl) nameEl.textContent = s.playerName || 'Saikoro';
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
  const locForArea = s.travel ? s.travel.to : s.locationId;
  const areaN = areaOfLoc(locForArea) || 1;
  const zoneN = zoneOfLoc(locForArea) || 1;
  const areaZoneLabel = `Area ${areaN} · Z${zoneN}`;
  const h1 = document.querySelector('header h1');
  if (h1) h1.textContent = `Saikoro Journey · ${areaZoneLabel}`;
  document.title = `Saikoro Journey — ${areaZoneLabel}`;
  const travelLabel = s.travel
    ? (() => {
        const pct = Math.min(100, Math.round((s.travel.elapsedMs / s.travel.durationMs) * 100));
        const leftMs = Math.max(0, s.travel.durationMs - s.travel.elapsedMs);
        const toArea = areaOfLoc(s.travel.to) || 1;
        const toZone = zoneOfLoc(s.travel.to) || 1;
        return `A${toArea}Z${toZone} moving → ${locName(s.travel.to)} (${pct}% · ${formatEta(leftMs)})`;
      })()
    : here
      ? `A${areaN}Z${zoneN} · ${here.name}`
      : s.locationId;
  setText('hud-loc', travelLabel);
  // Slice AO — area property chip (climate + optional bridge gate hint)
  {
    const propEl = document.getElementById('hud-area-prop');
    if (propEl) {
      const prop = areaPropertyForLoc(locForArea);
      let line = prop ? `${prop.climate} — ${prop.blurb}` : '';
      const standId = s.travel ? null : s.locationId;
      if (
        standId &&
        (standId === AREA_BRIDGE_A || standId === AREA_BRIDGE_B) &&
        (s.capacityLevel | 0) < 1
      ) {
        line = (line ? line + ' · ' : '') + 'Need Capacity Lv1 to cross Exit Ash ↔ Mist Spur';
      }
      if (line) {
        propEl.hidden = false;
        propEl.textContent = line;
        propEl.title = line;
      } else {
        propEl.hidden = true;
        propEl.textContent = '';
      }
    }
  }

  // Slice AU — hide deep future zones; show unlocked + next unlock target(s) only
  const mapVis = mapVisibleLocIds(s);

  document.querySelectorAll('.node-wrap').forEach((wrap) => {
    const id = wrap.dataset.locId;
    const visible = mapVis.has(id);
    wrap.classList.toggle('map-hidden', !visible);
    wrap.hidden = !visible;
  });

  document.querySelectorAll('.node').forEach((el) => {
    const id = el.dataset.locId;
    const unlocked = s.unlocked.includes(id);
    el.classList.toggle('locked', !unlocked);
    el.classList.toggle('current', !s.travel && id === s.locationId);
    el.classList.toggle('selected', id === s.selectedLocId);
    el.classList.toggle('dest', !!s.travel && id === s.travel.to);
    // Locked: disabled + tabindex=-1 so Tab skips (aria-disabled alone is not enough)
    // Locked-but-visible unlock targets keep locked styling (hand-in destinations)
    el.disabled = !unlocked;
    el.tabIndex = unlocked ? 0 : -1;
    el.setAttribute('tabindex', unlocked ? '0' : '-1');
    el.setAttribute('aria-disabled', unlocked ? 'false' : 'true');
  });

  document.querySelectorAll('.rail').forEach((line) => {
    const a = line.dataset.a;
    const b = line.dataset.b;
    const railVis = mapVis.has(a) && mapVis.has(b);
    line.classList.toggle('map-hidden', !railVis);
    if (railVis) line.removeAttribute('hidden');
    else line.setAttribute('hidden', '');
    const active =
      s.travel &&
      ((s.travel.from === a && s.travel.to === b) || (s.travel.from === b && s.travel.to === a));
    line.classList.toggle('active', !!active);
    const bothUnlocked = s.unlocked.includes(a) && s.unlocked.includes(b);
    line.classList.toggle('locked', !bothUnlocked);
  });

  // Slice AU — Area climate labels only when area has a map-visible loc
  document.querySelectorAll('.map-area-label').forEach((el) => {
    const areaId = Number(el.dataset.areaId);
    const show = LOCATIONS.some((l) => areaOfLoc(l.id) === areaId && mapVis.has(l.id));
    el.classList.toggle('map-hidden', !show);
    el.hidden = !show;
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

  // Slice Q — courier map pin (◇)
  if (courierEl) {
    const c = s.courier;
    if (!c) {
      courierEl.hidden = true;
    } else {
      let cx;
      let cy;
      if (c.travel) {
        const from = LOCATIONS.find((l) => l.id === c.travel.from);
        const to = LOCATIONS.find((l) => l.id === c.travel.to);
        const tt = Math.min(1, c.travel.elapsedMs / c.travel.durationMs);
        cx = from.x + (to.x - from.x) * tt;
        cy = from.y + (to.y - from.y) * tt;
      } else {
        const loc = LOCATIONS.find((l) => l.id === c.locationId);
        cx = loc ? loc.x : 0;
        cy = loc ? loc.y : 0;
      }
      // offset so it doesn't sit under player pin when co-located
      courierEl.style.left = (cx + 10) + 'px';
      courierEl.style.top = (cy - 8) + 'px';
      courierEl.hidden = false;
      courierEl.classList.toggle('traveling', !!c.travel);
      courierEl.title = c.travel
        ? `courier → ${locName(c.travel.finalDest || c.travel.to)}`
        : `courier @ ${locName(c.locationId)}`;
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
        const spd = effectiveSpeed(s.speedLevel);
        const neigh = neighborsOf(fromId).filter((id) => s.unlocked.includes(id) && id !== s.travel.to);
        destList.innerHTML = neigh
          .map((id) => {
            const ms = travelMsBetween(fromId, id, spd) || 0;
            return destGoButtonHtml(s, fromId, id, ms, true);
          })
          .join('');
        // also allow stop via going "home" listed? Stop button handles abort
        if (destEmpty) destEmpty.hidden = neigh.length > 0;
      }
    } else {
      destPanel.hidden = false;
      if (dsig !== lastDestSig) {
        lastDestSig = dsig;
        const spd = effectiveSpeed(s.speedLevel);
        const neigh = neighborsOf(s.locationId).filter((id) => s.unlocked.includes(id));
        destList.innerHTML = neigh
          .map((id) => {
            const ms = travelMsBetween(s.locationId, id, spd) || 0;
            return destGoButtonHtml(s, s.locationId, id, ms, false);
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
    const csig = cargoSignature(s);
    if (csig !== lastCargoSig) {
      lastCargoSig = csig;
      cargoList.classList.add('inv-icons');
      const rows = [];
      if (s.quest && s.quest.qty > 0) {
        const q = s.quest;
        const depletes = depleteRateForGood(q.goodId) > 0;
        const cond = depletes ? Math.round(q.condition ?? 100) : null;
        const title = `Quest ${goodName(q.goodId)} — dedicated lot (not sellable)${cond != null ? ` · ${cond}%` : ''}`;
        rows.push(
          `<li class="inv-stack quest-lot" title="${title}">` +
            `<span class="inv-icon" aria-hidden="true">${goodIcon(q.goodId)}</span>` +
            `<span class="inv-qty">×${q.qty}</span>` +
            `<span class="inv-badge">Q</span></li>`,
        );
      }
      for (const st of s.cargoStacks || []) {
        if (!st || !(st.qty > 0)) continue;
        const depletes = depleteRateForGood(st.goodId) > 0;
        const cond = depletes ? Math.round(st.condition ?? 100) : null;
        const condBadge = cond == null ? '' : `<span class="inv-cond">${cond}%</span>`;
        rows.push(
          `<li class="inv-stack" data-stack-id="${st.id}" data-good="${st.goodId}" title="${stackHoverTitle(st)}">` +
            `<span class="inv-icon" aria-hidden="true">${goodIcon(st.goodId)}</span>` +
            `<span class="inv-qty">×${st.qty}</span>` +
            `<span class="inv-badge">${st.unitPrice}G</span>${condBadge}</li>`,
        );
      }
      cargoList.innerHTML = rows.join('');
      if (cargoEmpty) cargoEmpty.hidden = rows.length > 0;
    }
  }

  // Slice U — personal / key inventory (no weight)
  {
    const personalList = document.getElementById('personal-list');
    const personalEmpty = document.getElementById('personal-empty');
    if (personalList) {
      const psig = personalSignature(s);
      if (psig !== lastPersonalSig) {
        lastPersonalSig = psig;
        const bag = s.personal && typeof s.personal === 'object' ? s.personal : {};
        personalList.classList.add('inv-icons');
        const rows = [];
        for (const d of PERSONAL_DEFS) {
          const n = bag[d.id] || 0;
          if (n <= 0) continue;
          const desc = personalDescription(d.id) || d.desc || '';
          const title = `${d.name} — ${desc}`;
          const qty = d.kind === 'key' && n === 1 ? '' : `×${n}`;
          rows.push(
            `<li class="inv-stack" data-personal="${d.id}" title="${title}">` +
              `<span class="inv-icon" aria-hidden="true">${personalIcon(d.id)}</span>` +
              (qty ? `<span class="inv-qty">${qty}</span>` : '') +
              `<span class="inv-badge">${d.kind}</span></li>`,
          );
        }
        for (const id of Object.keys(bag).sort()) {
          if (PERSONAL_DEFS.some((d) => d.id === id)) continue;
          const n = bag[id] || 0;
          if (n <= 0) continue;
          rows.push(
            `<li class="inv-stack" title="${id}">` +
              `<span class="inv-icon" aria-hidden="true">○</span>` +
              `<span class="inv-qty">×${n}</span></li>`,
          );
        }
        personalList.innerHTML = rows.join('');
        if (personalEmpty) personalEmpty.hidden = rows.length > 0;
      }
    }
  }

  if (s._conditionWaste && s._conditionWaste.length) {
    const names = s._conditionWaste.join(', ');
    s._conditionWaste = null;
    if (ui) ui.lastMsg = `wasted: ${names}`;
  }
  if (s._questMsg) {
    if (ui) ui.lastMsg = s._questMsg;
    s._questMsg = null;
  }

  // Slice O — quest offer (right) + active (left)
  {
    const offerPanel = document.getElementById('quest-offer-panel');
    const activePanel = document.getElementById('quest-active-panel');
    const panelOpen = ui.panelOpen !== false;
    const docked = !s.travel;
    if (offerPanel) {
      const offer = !s.quest && docked ? TRANSPORT_QUESTS[s.locationId] : null;
      const show = !!offer && panelOpen && s.unlocked.includes(s.locationId);
      offerPanel.hidden = !show;
      if (show && offer) {
        setText(
          'quest-offer-text',
          `Carry ${goodName(offer.goodId)} ×${offer.qty} → ${locName(offer.to)}`,
        );
        setText('quest-offer-reward', `Reward ${offer.rewardGold}G · dedicated lot (not sellable)`);
        const btn = document.getElementById('btn-quest-accept');
        if (btn) {
          const w = goodWeightG(offer.goodId) * offer.qty;
          const destUnlocked = s.unlocked.includes(offer.to);
          const fits = cargoUsed(s) + w <= s.capacity;
          const can = destUnlocked && fits;
          btn.disabled = !can;
          if (can) {
            btn.title = 'Accept transport quest';
          } else if (!destUnlocked) {
            // Slice AK — distinct from capacity (AI nit)
            btn.title = `Destination locked: ${locName(offer.to)}`;
          } else {
            btn.title = `Need cargo capacity (quest needs ${w}g)`;
          }
        }
      }
    }
    if (activePanel) {
      activePanel.hidden = !s.quest;
      if (s.quest) {
        const q = s.quest;
        const cond = Math.round(q.condition ?? 100);
        setText(
          'quest-active-summary',
          `${locName(q.from)} → ${locName(q.to)}`,
        );
        setText(
          'quest-active-detail',
          `${goodName(q.goodId)} ×${q.qty}` +
            (depleteRateForGood(q.goodId) > 0 ? ` · ${cond}%` : '') +
            ` · ${q.rewardGold}G`,
        );
        const del = document.getElementById('btn-quest-deliver');
        if (del) {
          const atDest = !s.travel && s.locationId === q.to && q.condition > 0;
          del.disabled = !atDest;
          del.title = atDest ? 'Deliver quest cargo' : 'Deliver at destination';
        }
      }
    }
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
          ? 'Stop → origin · Destinations / Travel / map chip re-route'
          : 'Stop / re-route locked until unlock.',
      );
    } else {
      travelPanel.hidden = true;
      const fill = document.getElementById('travel-bar-fill');
      if (fill) fill.style.width = '0%';
    }
  }

  // Travel to / Travel (panel + map under chip) — Slice D; mid-route when STOP_REROUTE_UNLOCKED (Slice J)
  {
    const panelOpen = ui.panelOpen !== false;
    const target = s.selectedLocId || s.locationId;
    const name = locName(target);
    const here = target === s.locationId;
    const unlocked = s.unlocked.includes(target);
    const adjacent = !here && neighborsOf(s.locationId).includes(target);
    const sameDest = !!(s.travel && target === s.travel.to);
    let can = false;
    let hint = '';
    if (s.travel && !STOP_REROUTE_UNLOCKED) {
      can = false;
      hint = 'traveling…';
    } else if (s.travel && STOP_REROUTE_UNLOCKED) {
      can = unlocked && adjacent && !sameDest;
      if (sameDest) hint = 'current destination';
      else if (here) hint = 'you are here (use Stop)';
      else if (!unlocked) hint = 'location locked';
      else if (!adjacent) hint = 'only adjacent locations';
      else hint = `re-route → ${name}`;
    } else {
      can = unlocked && adjacent;
      if (here) hint = 'you are here';
      else if (!unlocked) hint = 'location locked';
      else if (!adjacent) hint = 'only adjacent locations';
      else hint = `depart → ${name}`;
    }
    // Slice AO — soft capacity gate Exit Ash ↔ Mist Spur
    let departFreight = 0;
    if (can && !here) {
      const fromForGate = s.locationId;
      const bridgeMsg = areaBridgeBlockReason(s, fromForGate, target);
      if (bridgeMsg) {
        can = false;
        hint = bridgeMsg;
      }
    }
    // Slice AT — body-train freight on fresh depart (not re-route)
    if (can && !here && !s.travel) {
      departFreight = travelFreightCost(s.locationId, target) || 0;
      if (departFreight > 0) {
        hint = `depart → ${name} · ${departFreight}g freight`;
        if ((s.gold | 0) < departFreight) {
          can = false;
          hint = `Need ${departFreight}g freight (have ${s.gold | 0}g)`;
        }
      }
    }
    for (const id of ['btn-travel-to', 'btn-travel']) {
      const btn = document.getElementById(id);
      if (!btn) continue;
      btn.disabled = !can;
      btn.title = hint;
      if (id === 'btn-travel-to') {
        if (s.travel && STOP_REROUTE_UNLOCKED && can) btn.textContent = `Re-route ${name}`;
        else btn.textContent = here ? 'Travel to' : `Travel to ${name}`;
      } else {
        btn.textContent = s.travel && STOP_REROUTE_UNLOCKED && can ? 'Re-route' : 'Travel';
      }
    }
    setText('loc-travel-hint', hint);
    setText('station-travel-hint', hint);

    document.querySelectorAll('.map-travel').forEach((btn) => {
      const locId = btn.dataset.loc;
      const allowMid = !s.travel || STOP_REROUTE_UNLOCKED;
      const show = panelOpen && !!s.selectedLocId && locId === s.selectedLocId && allowMid;
      btn.hidden = !show;
      if (!show) {
        btn.disabled = true;
        return;
      }
      const thisSameDest = !!(s.travel && locId === s.travel.to);
      let thisCan =
        s.unlocked.includes(locId) &&
        locId !== s.locationId &&
        neighborsOf(s.locationId).includes(locId) &&
        !thisSameDest;
      let thisHint = hint;
      let thisFreight = 0;
      if (thisCan) {
        const bridgeMsg = areaBridgeBlockReason(s, s.locationId, locId);
        if (bridgeMsg) {
          thisCan = false;
          thisHint = bridgeMsg;
        }
      }
      if (thisCan && !s.travel) {
        thisFreight = travelFreightCost(s.locationId, locId) || 0;
        if (thisFreight > 0) {
          thisHint = `Travel to ${locName(locId)} · ${thisFreight}g freight`;
          if ((s.gold | 0) < thisFreight) {
            thisCan = false;
            thisHint = `Need ${thisFreight}g freight (have ${s.gold | 0}g)`;
          }
        }
      }
      btn.disabled = !thisCan;
      btn.textContent = s.travel && STOP_REROUTE_UNLOCKED ? 'Re-route' : 'Travel';
      btn.title = thisCan
        ? (s.travel
            ? `Re-route → ${locName(locId)}`
            : thisFreight > 0
              ? thisHint
              : `Travel to ${locName(locId)}`)
        : thisHint;
    });
  }

  // Station panels (quotes + unlock): Esc / blank map closes; node click reopens
  {
    const panelOpen = ui.panelOpen !== false;
    const quotePanel = document.getElementById('quote-panel');
    if (quotePanel) quotePanel.hidden = !panelOpen;
    const unlockPanel = document.getElementById('unlock-panel');
    if (unlockPanel) {
      const hasOffers = unlockPanel.dataset.hasOffers === '1' || availableUnlocks(s.unlocked).length > 0;
      unlockPanel.hidden = !hasOffers || !panelOpen;
    }
  }

  // Capacity upgrade stub (Options)
  {
    const level = Math.max(0, Math.min(CAPACITY_MAX_LEVEL, s.capacityLevel | 0));
    // keep s.capacity synced
    const cap = effectiveCapacity(level);
    if (s.capacity !== cap) s.capacity = cap;
    setText('cargo-level-label', `Cargo level ${level} / ${CAPACITY_MAX_LEVEL} · ${cap}g`);
    const cost = capacityUpgradeCost(level);
    const btn = document.getElementById('btn-upgrade-cargo');
    if (btn) {
      const atMax = level >= CAPACITY_MAX_LEVEL;
      btn.disabled = atMax || s.gold < cost;
      btn.textContent = atMax
        ? 'Cargo maxed (10000g)'
        : `Upgrade cargo (+20%) — ${cost}G`;
      btn.title = atMax
        ? 'Max capacity level'
        : `Stub pricing: 500×(level+1). Next: ${cap} → ${effectiveCapacity(level + 1)}g`;
    }
  }

  // Slice Z — Preserve rate upgrade (Options)
  {
    const level = Math.max(0, Math.min(PRESERVE_MAX_LEVEL, s.preserveLevel | 0));
    const factor = preserveDrainFactor(level);
    const pct = Math.round(factor * 100);
    setText('preserve-level-label', `Preserve level ${level} / ${PRESERVE_MAX_LEVEL} · drain ×${pct}%`);
    const cost = preserveUpgradeCost(level);
    const btn = document.getElementById('btn-upgrade-preserve');
    if (btn) {
      const atMax = level >= PRESERVE_MAX_LEVEL;
      btn.disabled = atMax || s.gold < cost;
      btn.textContent = atMax
        ? 'Preserve maxed (×40% drain)'
        : `Upgrade preserve (−12% drain) — ${cost}G`;
      btn.title = atMax
        ? 'Max preserve level'
        : `Stub pricing: 600×(level+1). Drain factor ${pct}% → ${Math.round(preserveDrainFactor(level + 1) * 100)}%`;
    }
  }

  // Slice AA — Speed upgrade (Options)
  {
    const level = Math.max(0, Math.min(SPEED_MAX_LEVEL, s.speedLevel | 0));
    const spd = effectiveSpeed(level);
    setText('speed-level-label', `Speed level ${level} / ${SPEED_MAX_LEVEL} · speed ${spd}`);
    const cost = speedUpgradeCost(level);
    const btn = document.getElementById('btn-upgrade-speed');
    if (btn) {
      const atMax = level >= SPEED_MAX_LEVEL;
      btn.disabled = atMax || s.gold < cost;
      btn.textContent = atMax
        ? 'Speed maxed (×2)'
        : `Upgrade speed (+20%) — ${cost}G`;
      btn.title = atMax
        ? 'Max speed level'
        : `Stub pricing: 550×(level+1). Speed ${spd} → ${effectiveSpeed(level + 1)}`;
    }
  }

  // Slice V — character page (read-only sheet)
  {
    const panel = document.getElementById('character-panel');
    if (panel && ui.characterOpen) {
      panel.hidden = false;
      const bodyId = s.chosenBodyId || 'body_a';
      const glyph = BODY_GLYPH[bodyId] || BODY_GLYPH.body_a || '■';
      const glyphEl = document.getElementById('character-glyph');
      if (glyphEl) glyphEl.textContent = glyph;
      setText('character-name', s.playerName || 'Saikoro');
      setText('character-body-label', bodyId);
      const level = Math.max(0, Math.min(CAPACITY_MAX_LEVEL, s.capacityLevel | 0));
      const cap = effectiveCapacity(level);
      setText('character-capacity', `Cargo level ${level} / ${CAPACITY_MAX_LEVEL} · ${cap}g`);
      {
        const pl = Math.max(0, Math.min(PRESERVE_MAX_LEVEL, s.preserveLevel | 0));
        const pct = Math.round(preserveDrainFactor(pl) * 100);
        setText('character-preserve', `Preserve level ${pl} / ${PRESERVE_MAX_LEVEL} · drain ×${pct}%`);
      }
      {
        const sl = Math.max(0, Math.min(SPEED_MAX_LEVEL, s.speedLevel | 0));
        const spd = effectiveSpeed(sl);
        setText('character-speed', `Speed level ${sl} / ${SPEED_MAX_LEVEL} · speed ${spd}`);
      }
      setText(
        'character-courier',
        s.universalCourierUnlocked
          ? 'Courier range: universal (unlocked)'
          : 'Courier range: Zone 1',
      );
      setText('character-gold', `Gold ${s.gold}`);
      const keysList = document.getElementById('character-keys');
      const keysEmpty = document.getElementById('character-keys-empty');
      if (keysList) {
        const bag = s.personal && typeof s.personal === 'object' ? s.personal : {};
        const rows = [];
        keysList.classList.add('inv-icons');
        for (const d of PERSONAL_DEFS) {
          const n = bag[d.id] || 0;
          if (n <= 0) continue;
          if (d.kind !== 'key') continue;
          const desc = personalDescription(d.id) || d.desc || '';
          const title = `${d.name} — ${desc}`;
          const qty = n === 1 ? '' : `×${n}`;
          rows.push(
            `<li class="inv-stack" title="${title}">` +
              `<span class="inv-icon" aria-hidden="true">${personalIcon(d.id)}</span>` +
              (qty ? `<span class="inv-qty">${qty}</span>` : '') +
              `<span class="inv-badge">key</span></li>`,
          );
        }
        for (const id of Object.keys(bag).sort()) {
          if (PERSONAL_DEFS.some((d) => d.id === id)) continue;
          const n = bag[id] || 0;
          if (n <= 0) continue;
          rows.push(
            `<li class="inv-stack" title="${id}">` +
              `<span class="inv-icon" aria-hidden="true">○</span>` +
              `<span class="inv-qty">×${n}</span></li>`,
          );
        }
        keysList.innerHTML = rows.join('');
        if (keysEmpty) keysEmpty.hidden = rows.length > 0;
      }
    } else if (panel && !ui.characterOpen) {
      panel.hidden = true;
    }
  }

  // Slice Q — hire button in Options + left courier / transfer panels
  {
    const hirePanel = document.getElementById('courier-hire-panel');
    if (hirePanel) {
      const canHire = s.unlocked.includes(COURIER_UNLOCK_LOC) && !s.courier;
      hirePanel.hidden = !canHire;
    }
    const cPanel = document.getElementById('courier-panel');
    const xPanel = document.getElementById('transfer-panel');
    const c = s.courier;
    if (cPanel) {
      cPanel.hidden = !c;
      if (c) {
        const used = courierCargoUsed(c);
        setText(
          'courier-summary',
          `${c.gold}G · ${used}/${c.capacity}g · ${locName(c.locationId)}`,
        );
        let st = c.paused ? 'paused' : c.travel
          ? `→ ${locName(c.travel.finalDest || c.travel.to)}`
          : (c.route.length < 2 ? 'docked (need ≥2 stops)' : 'docked');
        setText('courier-status', st);
        setText(
          'courier-range',
          s.universalCourierUnlocked
            ? 'Range: universal (unlocked)'
            : 'Range: Zone 1',
        );
        const pauseBtn = document.getElementById('btn-courier-pause');
        const resumeBtn = document.getElementById('btn-courier-resume');
        if (pauseBtn) pauseBtn.hidden = !!c.paused;
        if (resumeBtn) resumeBtn.hidden = !c.paused;

        // Slice R/AE — courier cargo stacks as icons
        const cargoUl = document.getElementById('courier-cargo-list');
        if (cargoUl) {
          cargoUl.classList.add('inv-icons');
          const rows = [];
          for (const st of c.cargoStacks || []) {
            if (!st || !(st.qty > 0)) continue;
            const depletes = depleteRateForGood(st.goodId) > 0;
            const cond = depletes ? Math.round(st.condition ?? 100) : null;
            const condBadge = cond == null ? '' : `<span class="inv-cond">${cond}%</span>`;
            rows.push(
              `<li class="inv-stack" data-stack-id="${st.id}" data-good="${st.goodId}" title="${stackHoverTitle(st)}">` +
                `<span class="inv-icon" aria-hidden="true">${goodIcon(st.goodId)}</span>` +
                `<span class="inv-qty">×${st.qty}</span>` +
                `<span class="inv-badge">${st.unitPrice}G</span>${condBadge}</li>`,
            );
          }
          cargoUl.innerHTML = rows.length ? rows.join('') : '<li class="muted">empty</li>';
        }

        // Slice R — rebuild trade UI only when route/trade/pause change (not gold/cargo)
        const rsig = [
          c.route.join(','),
          c.routeIndex,
          c.paused ? 1 : 0,
          s.universalCourierUnlocked ? 1 : 0,
          s.unlocked.join(','),
          JSON.stringify(c.trade || {}),
        ].join('|');
        if (rsig !== lastCourierPanelSig) {
          lastCourierPanelSig = rsig;
          const routeList = document.getElementById('courier-route-list');
          if (routeList) {
            routeList.innerHTML = c.route
              .map((id, i) => {
                const cur = i === (c.routeIndex % Math.max(1, c.route.length)) ? ' · next' : '';
                return `<li data-idx="${i}"><span>${locName(id)}${cur}</span>
                  <button type="button" data-act="courier-route-up" data-idx="${i}" title="up">↑</button>
                  <button type="button" data-act="courier-route-down" data-idx="${i}" title="down">↓</button>
                  <button type="button" data-act="courier-route-rm" data-idx="${i}" title="remove">×</button>
                </li>`;
              })
              .join('');
          }
          const addWrap = document.getElementById('courier-route-add');
          if (addWrap) {
            const missing = s.unlocked.filter((id) => courierLocAllowed(s, id) && !c.route.includes(id));
            addWrap.innerHTML = missing
              .map(
                (id) =>
                  `<button type="button" data-act="courier-route-add" data-loc="${id}">+ ${locName(id)}</button>`,
              )
              .join(' ');
          }
          const tradeWrap = document.getElementById('courier-trade-list');
          if (tradeWrap) {
            const openLocs = new Set(
              [...tradeWrap.querySelectorAll('details.courier-trade-stop[open]')].map(
                (d) => d.getAttribute('data-loc'),
              ),
            );
            tradeWrap.innerHTML = c.route
              .map((locId) => {
                const rows = GOODS.map((g) => {
                  const flags = c.trade?.[locId]?.[g.id] || { buy: false, sell: false };
                  return `<label class="courier-trade-row"><span>${g.name}</span>
                    <input type="checkbox" data-act="courier-trade" data-loc="${locId}" data-good="${g.id}" data-side="buy" ${flags.buy ? 'checked' : ''}/> buy
                    <input type="checkbox" data-act="courier-trade" data-loc="${locId}" data-good="${g.id}" data-side="sell" ${flags.sell ? 'checked' : ''}/> sell
                  </label>`;
                }).join('');
                const openAttr = openLocs.has(locId) ? ' open' : '';
                return `<details class="courier-trade-stop" data-loc="${locId}"${openAttr}><summary>${locName(locId)}</summary>${rows}</details>`;
              })
              .join('');
          }
        }
      } else {
        lastCourierPanelSig = '';
      }
    }
    if (xPanel) {
      const showX = courierCoLocated(s);
      xPanel.hidden = !showX;
      if (showX && c) {
        const pStacks = (s.cargoStacks || []).filter((st) => st && st.qty > 0);
        const cStacks = (c.cargoStacks || []).filter((st) => st && st.qty > 0);
        const tsig = [
          s.gold,
          c.gold,
          ...pStacks.map((st) => `p:${st.id}:${st.qty}:${st.unitPrice}`),
          ...cStacks.map((st) => `c:${st.id}:${st.qty}:${st.unitPrice}`),
        ].join('|');
        if (tsig !== lastTransferSig) {
          lastTransferSig = tsig;
          const ul = document.getElementById('transfer-goods');
          if (ul) {
            const rows = [];
            for (const st of pStacks) {
              rows.push(`<li data-stack-id="${st.id}" data-good="${st.goodId}" data-side="player">
                <span class="inv-icon inline" title="${stackHoverTitle(st)}">${goodIcon(st.goodId)}</span>
                <span>you · ${goodName(st.goodId)} @${st.unitPrice}G ×${st.qty}</span>
                <input type="number" class="qty" data-xfer-stack="${st.id}" min="1" value="1" />
                <button type="button" data-act="xfer-good-to-courier" data-good="${st.goodId}" data-stack-id="${st.id}">→ C</button>
              </li>`);
            }
            for (const st of cStacks) {
              rows.push(`<li data-stack-id="${st.id}" data-good="${st.goodId}" data-side="courier">
                <span class="inv-icon inline" title="${stackHoverTitle(st)}">${goodIcon(st.goodId)}</span>
                <span>C · ${goodName(st.goodId)} @${st.unitPrice}G ×${st.qty}</span>
                <input type="number" class="qty" data-xfer-stack="${st.id}" min="1" value="1" />
                <button type="button" data-act="xfer-good-to-player" data-good="${st.goodId}" data-stack-id="${st.id}">→ You</button>
              </li>`);
            }
            if (!rows.length) {
              rows.push('<li class="muted">no stacks to move</li>');
            }
            ul.innerHTML = rows.join('');
          }
        }
      } else {
        lastTransferSig = '';
      }
    }
  }

  // Slice AB/AG — warehouse panel (Broken Lamp / Mist Spur hubs)
  {
    const whPanel = document.getElementById('warehouse-panel');
    if (whPanel) {
      const hubKey = warehouseKeyAtPlayer(s);
      const atHub = !!hubKey && playerAtWarehouse(s);
      whPanel.hidden = !atHub;
      if (atHub) {
        ensureWarehouse(s, hubKey);
        const areaLabel = hubKey === 'area2' ? 'Area 2' : 'Area 1';
        const hubName = hubKey === 'area2' ? 'Mist Spur' : 'Broken Lamp';
        const whTitle = whPanel.querySelector('h2');
        if (whTitle) whTitle.textContent = `${areaLabel} Safe House / Warehouse`;
        const whHint = whPanel.querySelector('p.hint:not(#warehouse-cap)');
        if (whHint) whHint.textContent = `${hubName} hub · goods only · no quest lots. Soft cap ${WAREHOUSE_CAP}g. Separate stock per area.`;

        const courierHere = courierAtWarehouse(s);
        if (!ui.warehouseWho) ui.warehouseWho = 'player';
        if (ui.warehouseWho === 'courier' && !courierHere) ui.warehouseWho = 'player';
        const who = ui.warehouseWho === 'courier' && courierHere ? 'courier' : 'player';
        ui.warehouseWho = who;

        const tabs = document.getElementById('warehouse-who-tabs');
        if (tabs) {
          tabs.hidden = !courierHere;
          const bp = document.getElementById('btn-wh-tab-player');
          const bc = document.getElementById('btn-wh-tab-courier');
          if (bp) bp.classList.toggle('active', who === 'player');
          if (bc) bc.classList.toggle('active', who === 'courier');
        }
        setText(
          'warehouse-who-label',
          who === 'courier' ? 'Moving: courier cargo ↔ warehouse' : 'Moving: player cargo ↔ warehouse',
        );

        const used = warehouseUsed(s, hubKey);
        setText('warehouse-cap', `${used} / ${WAREHOUSE_CAP} g`);

        const bagStacks = who === 'courier' ? (s.courier.cargoStacks || []) : (s.cargoStacks || []);
        const bagUsed = who === 'courier' ? courierCargoUsed(s.courier) : cargoUsed(s);
        const bagCap = who === 'courier' ? s.courier.capacity : s.capacity;
        const free = Math.max(0, bagCap - bagUsed);

        const wh = ensureWarehouse(s, hubKey);
        const whStacks = wh.stacks || [];
        const sigParts = [
          hubKey,
          who,
          used,
          bagUsed,
          bagCap,
          courierHere ? 1 : 0,
          ...whStacks.map((st) => `w:${st.id}:${st.qty}:${st.unitPrice}:${Math.round(st.condition ?? 100)}`),
          ...bagStacks.map((st) => `b:${st.id}:${st.qty}:${st.unitPrice}:${Math.round(st.condition ?? 100)}`),
        ];
        const wsig = sigParts.join('|');
        if (wsig !== lastWarehouseSig) {
          lastWarehouseSig = wsig;
          const ul = document.getElementById('warehouse-list');
          const emptyEl = document.getElementById('warehouse-empty');
          const rows = [];
          ul?.classList.add('inv-icons');
          // bag stacks → deposit (icon tiles)
          let bagHeader = false;
          for (const st of bagStacks) {
            if (!st || !(st.qty > 0)) continue;
            if (!bagHeader) {
              rows.push(`<li class="inv-section">${who === 'courier' ? 'courier cargo' : 'your cargo'}</li>`);
              bagHeader = true;
            }
            const depletes = depleteRateForGood(st.goodId) > 0;
            const cond = depletes ? Math.round(st.condition ?? 100) : null;
            const condBadge = cond == null ? '' : `<span class="inv-cond">${cond}%</span>`;
            const sideLabel = who === 'courier' ? 'C' : 'you';
            const title = `${stackHoverTitle(st)} · ${who === 'courier' ? 'courier' : 'you'} (deposit)`;
            rows.push(
              `<li class="inv-stack wh-bag" data-stack-id="${st.id}" data-good="${st.goodId}" data-side="bag" title="${title}">` +
                `<span class="inv-side">${sideLabel}</span>` +
                `<span class="inv-icon" aria-hidden="true">${goodIcon(st.goodId)}</span>` +
                `<span class="inv-qty">×${st.qty}</span>` +
                `<span class="inv-badge">${st.unitPrice}G</span>${condBadge}</li>`,
            );
          }
          // warehouse stacks → withdraw
          let whHeader = false;
          for (const st of whStacks) {
            if (!st || !(st.qty > 0)) continue;
            if (!whHeader) {
              rows.push('<li class="inv-section">warehouse</li>');
              whHeader = true;
            }
            const depletes = depleteRateForGood(st.goodId) > 0;
            const cond = depletes ? Math.round(st.condition ?? 100) : null;
            const condBadge = cond == null ? '' : `<span class="inv-cond">${cond}%</span>`;
            const title = `${stackHoverTitle(st)} · warehouse (withdraw)`;
            rows.push(
              `<li class="inv-stack wh-store" data-stack-id="${st.id}" data-good="${st.goodId}" data-side="wh" title="${title}">` +
                `<span class="inv-side">WH</span>` +
                `<span class="inv-icon" aria-hidden="true">${goodIcon(st.goodId)}</span>` +
                `<span class="inv-qty">×${st.qty}</span>` +
                `<span class="inv-badge">${st.unitPrice}G</span>${condBadge}</li>`,
            );
          }
          if (ul) ul.innerHTML = rows.join('');
          if (emptyEl) emptyEl.hidden = rows.length > 0;
          // drop selection if stack vanished
          if (ui.warehouseSel) {
            const still =
              (ui.warehouseSel.side === 'bag' &&
                bagStacks.some((st) => st && st.id === ui.warehouseSel.stackId && st.qty > 0)) ||
              (ui.warehouseSel.side === 'wh' &&
                whStacks.some((st) => st && st.id === ui.warehouseSel.stackId && st.qty > 0));
            if (!still) ui.warehouseSel = null;
          }
        }
        // selection chrome + shared action bar (every frame while at hub)
        {
          const ul = document.getElementById('warehouse-list');
          const sel = ui.warehouseSel;
          if (ul) {
            ul.querySelectorAll('.inv-stack[data-stack-id]').forEach((li) => {
              const on =
                !!sel &&
                li.dataset.stackId === sel.stackId &&
                li.dataset.side === sel.side;
              li.classList.toggle('selected', on);
            });
          }
          const bar = document.getElementById('warehouse-actions');
          const label = document.getElementById('warehouse-sel-label');
          const qtyIn = document.getElementById('wh-sel-qty');
          const btnQty = document.getElementById('btn-wh-mode-qty');
          const btnAll = document.getElementById('btn-wh-mode-all');
          if (bar && btnQty && btnAll && qtyIn) {
            if (!sel) {
              bar.hidden = true;
              if (label) label.textContent = 'select a stack';
            } else {
              const pool = sel.side === 'bag' ? bagStacks : whStacks;
              const st = pool.find((x) => x && x.id === sel.stackId);
              if (!st || !(st.qty > 0)) {
                bar.hidden = true;
                ui.warehouseSel = null;
              } else {
                bar.hidden = false;
                const gname = goodName(st.goodId);
                const sideTxt =
                  sel.side === 'bag'
                    ? who === 'courier'
                      ? 'courier → warehouse'
                      : 'you → warehouse'
                    : who === 'courier'
                      ? 'warehouse → courier'
                      : 'warehouse → you';
                if (label) {
                  label.textContent = `${gname} @${st.unitPrice}G ×${st.qty} · ${sideTxt}`;
                }
                qtyIn.dataset.whStackQty = st.id;
                qtyIn.setAttribute('data-wh-stack-qty', st.id);
                qtyIn.max = String(st.qty);
                const act = sel.side === 'bag' ? 'wh-deposit' : 'wh-withdraw';
                btnQty.dataset.act = act;
                btnQty.dataset.mode = 'qty';
                btnQty.dataset.good = st.goodId;
                btnQty.dataset.stackId = st.id;
                btnQty.textContent = sel.side === 'bag' ? 'Deposit N' : 'Withdraw N';
                btnQty.disabled = false;
                btnAll.dataset.act = act;
                btnAll.dataset.mode = sel.side === 'bag' ? 'all' : 'max';
                btnAll.dataset.good = st.goodId;
                btnAll.dataset.stackId = st.id;
                btnAll.textContent = sel.side === 'bag' ? 'Deposit all' : 'Withdraw max';
                if (sel.side === 'wh') {
                  const unit = goodWeightG(st.goodId);
                  const maxFit = unit > 0 ? Math.floor(free / unit) : 0;
                  btnAll.disabled = maxFit <= 0;
                } else {
                  btnAll.disabled = false;
                }
              }
            }
          }
        }
      } else {
        lastWarehouseSig = '';
        ui.warehouseSel = null;
        const bar = document.getElementById('warehouse-actions');
        if (bar) bar.hidden = true;
      }
    }
  }

  if (s._courierMsg) {
    if (ui) ui.lastMsg = s._courierMsg;
    s._courierMsg = null;
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
