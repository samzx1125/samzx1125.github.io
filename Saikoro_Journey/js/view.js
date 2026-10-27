import { LOCATIONS, EDGES } from './map-data.js';

/** @type {HTMLElement | null} */
let trainEl = null;

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
      btn.innerHTML = `<span class="node-name">${loc.name}</span>`;
      nodesEl.appendChild(btn);
    }
  }
}

/**
 * @param {import('./state.js').GameState} s
 * @param {{ lastMsg?: string }} ui
 */
export function render(s, ui = {}) {
  const here = LOCATIONS.find((l) => l.id === s.locationId);
  const travelLabel = s.travel
    ? `moving → ${s.travel.to} (${Math.min(100, Math.round((s.travel.elapsedMs / s.travel.durationMs) * 100))}%)`
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
    el.disabled = !unlocked;
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

  if (ui.lastMsg) setText('toast', ui.lastMsg);
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}
