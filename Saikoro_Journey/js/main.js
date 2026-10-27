/**
 * SaikoroJourney — Zone1 boot
 */
import { createInitialState } from './state.js';
import { tick } from './engine.js';
import { mountView, render } from './view.js';
import { bindEvents, getUi } from './events.js';
import { loadGame } from './saving.js';

const state = createInitialState();
const loaded = loadGame(state);
mountView();
bindEvents(state);
const ui = getUi();
if (loaded) ui.lastMsg = 'save loaded';
render(state, ui);

function loop(now) {
  tick(state, now);
  render(state, getUi());
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
