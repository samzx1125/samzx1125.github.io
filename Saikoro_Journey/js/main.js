/**
 * SaikoroJourney — Zone1 boot
 */
import { createInitialState } from './state.js?v=z1-20261028x';
import { tick } from './engine.js?v=z1-20261028x';
import { mountView, render } from './view.js?v=z1-20261028x';
import { bindEvents, getUi } from './events.js?v=z1-20261028x';
import { loadGame, saveGame } from './saving.js?v=z1-20261028x';
import { locName } from './map-data.js?v=z1-20261028x';

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
