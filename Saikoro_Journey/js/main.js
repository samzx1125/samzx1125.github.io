/**
 * SaikoroJourney — Zone1 boot
 */
import { createInitialState } from './state.js?v=z1-20261027v';
import { tick } from './engine.js?v=z1-20261027v';
import { mountView, render } from './view.js?v=z1-20261027v';
import { bindEvents, getUi } from './events.js?v=z1-20261027v';
import { loadGame, saveGame } from './saving.js?v=z1-20261027v';
import { locName } from './map-data.js?v=z1-20261027v';

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
