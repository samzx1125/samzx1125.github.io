/**
 * SaikoroJourney — Zone1 boot
 */
import { createInitialState } from './state.js?v=z1-20261028cq';
import { tick } from './engine.js?v=z1-20261028cq';
import { mountView, render } from './view.js?v=z1-20261028cq';
import { bindEvents, getUi } from './events.js?v=z1-20261028cq';
import { loadGame, saveGame } from './saving.js?v=z1-20261028cq';
import { locName } from './map-data.js?v=z1-20261028cq';
import { mountOpening } from './opening.js?v=z1-20261028cq';

const state = createInitialState();
const loaded = loadGame(state);
mountView();
const ui = getUi();
const opening = mountOpening(state, ui);
bindEvents(state, { opening });
if (loaded) ui.lastMsg = 'save loaded';
render(state, ui);

if (!state.openingDone) {
  opening.show();
} else {
  opening.hide();
}

let wasTraveling = false;
let wasCourierTraveling = false;
function loop(now) {
  // Pause sim while opening is up
  if (!state.openingDone) {
    render(state, getUi());
    requestAnimationFrame(loop);
    return;
  }
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
