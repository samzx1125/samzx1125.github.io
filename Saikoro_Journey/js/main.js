/**
 * SaikoroJourney — Zone1 boot
 */
import { createInitialState } from './state.js?v=z1-20261028ac';
import { tick } from './engine.js?v=z1-20261028ac';
import { mountView, render } from './view.js?v=z1-20261028ac';
import { bindEvents, getUi } from './events.js?v=z1-20261028ac';
import { loadGame, saveGame } from './saving.js?v=z1-20261028ac';
import { locName } from './map-data.js?v=z1-20261028ac';

const state = createInitialState();
const loaded = loadGame(state);
mountView();
bindEvents(state);
const ui = getUi();
if (loaded) ui.lastMsg = 'save loaded';
render(state, ui);

let wasTraveling = false;
let wasCourierTraveling = false;
function loop(now) {
  tick(state, now);
  if (wasTraveling && !state.travel) {
    saveGame(state);
    ui.lastMsg = `arrived ${locName(state.locationId)}`;
  }
  wasTraveling = !!state.travel;
  const cTraveling = !!(state.courier && state.courier.travel);
  if (wasCourierTraveling && !cTraveling && state.courier) {
    saveGame(state);
    if (state._courierArrived) {
      state._courierArrived = false;
      // keep quiet unless nothing else to say — avoid toast spam
    }
  }
  wasCourierTraveling = cTraveling;
  render(state, getUi());
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
