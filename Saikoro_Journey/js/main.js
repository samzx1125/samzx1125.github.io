/**
 * SaikoroJourney — Zone1 prototype boot
 * TODO(saving.js): localStorage save/load — next slice, not this PR
 */
import { createInitialState } from './state.js';
import { tick } from './engine.js';
import { mountView, render } from './view.js';
import { bindEvents, getUi } from './events.js';

const state = createInitialState();
mountView();
bindEvents(state);
render(state, getUi());

function loop(now) {
  tick(state, now);
  render(state, getUi());
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
