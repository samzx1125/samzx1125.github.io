import { neighborsOf, travelMsBetween } from './map-data.js';
import { tryTravel } from './engine.js';
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
}

export function getUi() {
  return ui;
}
