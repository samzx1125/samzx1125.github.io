/**
 * SaikoroJourney — Zone1 boot
 */
import { createInitialState } from './state.js';
import { tick } from './engine.js';
import { mountView, render } from './view.js';
import { bindEvents, getUi } from './events.js';
import { loadGame, saveGame } from './saving.js';
import { locName } from './map-data.js';

const state = createInitialState();
const loaded = loadGame(state);
mountView();
bindEvents(state);
const ui = getUi();
if (loaded) ui.lastMsg = 'save loaded';
render(state, ui);

let wasTraveling = false;
function loop(now) {
  tick(state, now);
  if (wasTraveling && !state.travel) {
    saveGame(state);
    ui.lastMsg = `arrived ${locName(state.locationId)}`;
  }
  wasTraveling = !!state.travel;
  render(state, getUi());
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
