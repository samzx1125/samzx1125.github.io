/**
 * Slice S — opening: name + body + mirror
 * Steps: name → body → mirror → enter game.
 */
import { saveGame } from './saving.js?v=z1-20261028av';
import { createInitialState } from './state.js?v=z1-20261028av';
import { KEY_MIRROR_RESIDUE } from './personal-data.js?v=z1-20261028av';
import { render } from './view.js?v=z1-20261028av';

export const BODY_IDS = ['body_a', 'body_b', 'body_c', 'body_d'];

/** Fixed mismatch map — reflection is never the chosen body. */
export const MIRROR_MAP = {
  body_a: 'body_c',
  body_b: 'body_d',
  body_c: 'body_a',
  body_d: 'body_b',
};

/** Mono silhouette glyphs (unicode blocks) — keep plain. */
export const BODY_GLYPH = {
  body_a: '▲',
  body_b: '●',
  body_c: '■',
  body_d: '◆',
};

/**
 * Apply createInitialState onto an existing state object (keeps references).
 * @param {import('./state.js').GameState} s
 */
export function resetStateInPlace(s) {
  const fresh = createInitialState();
  for (const key of Object.keys(s)) {
    if (!(key in fresh) && !key.startsWith('_')) delete s[key];
  }
  Object.assign(s, fresh);
}

/**
 * @param {import('./state.js').GameState} state
 * @param {{ lastMsg?: string, panelOpen?: boolean, optionsOpen?: boolean, characterOpen?: boolean }} ui
 * @param {{ onDone?: () => void }} [opts]
 */
export function mountOpening(state, ui, opts = {}) {
  const overlay = document.getElementById('opening-overlay');
  if (!overlay) return;

  const stepName = document.getElementById('opening-step-name');
  const stepBody = document.getElementById('opening-step-body');
  const stepMirror = document.getElementById('opening-step-mirror');
  const nameInput = document.getElementById('opening-name');
  const bodyGrid = document.getElementById('opening-body-grid');
  const mirrorGlyph = document.getElementById('opening-mirror-glyph');
  const mirrorFlavour = document.getElementById('opening-mirror-flavour');
  const mirrorChosen = document.getElementById('opening-mirror-chosen');

  function showStep(which) {
    if (stepName) stepName.hidden = which !== 'name';
    if (stepBody) stepBody.hidden = which !== 'body';
    if (stepMirror) stepMirror.hidden = which !== 'mirror';
  }

  function setOverlayVisible(vis) {
    if (!overlay) return;
    overlay.hidden = !vis;
    document.body.classList.toggle('opening-active', !!vis);
  }

  function buildBodyGrid() {
    if (!bodyGrid) return;
    bodyGrid.innerHTML = '';
    for (const id of BODY_IDS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'opening-body-card';
      btn.dataset.bodyId = id;
      btn.setAttribute('aria-pressed', state.chosenBodyId === id ? 'true' : 'false');
      if (state.chosenBodyId === id) btn.classList.add('selected');
      btn.innerHTML =
        `<span class="opening-silhouette" aria-hidden="true">${BODY_GLYPH[id]}</span>` +
        `<span class="opening-body-label">${id}</span>`;
      btn.addEventListener('click', () => {
        state.chosenBodyId = id;
        bodyGrid.querySelectorAll('.opening-body-card').forEach((el) => {
          const on = el.dataset.bodyId === id;
          el.classList.toggle('selected', on);
          el.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
      });
      bodyGrid.appendChild(btn);
    }
  }

  function fillMirror() {
    const chosen = state.chosenBodyId || 'body_a';
    const mirror = MIRROR_MAP[chosen] || 'body_c';
    if (mirrorGlyph) mirrorGlyph.textContent = BODY_GLYPH[mirror] || '?';
    if (mirrorChosen) {
      mirrorChosen.textContent = `you picked ${chosen} ${BODY_GLYPH[chosen] || ''} · mirror shows ${mirror}`;
    }
    // Dry humour · light Dice/賽子 hint · no god spoilers
    if (mirrorFlavour) {
      mirrorFlavour.textContent =
        'Odd. The glass rolls a different face — like a die that already moved. 賽子 laughs quietly. Don’t ask.';
    }
  }

  function goName() {
    showStep('name');
    if (nameInput) {
      nameInput.value = state.playerName || 'Saikoro';
      nameInput.focus();
      nameInput.select();
    }
  }

  function goBody() {
    const name = (nameInput?.value || '').trim() || 'Saikoro';
    state.playerName = name.slice(0, 24);
    if (!state.chosenBodyId) state.chosenBodyId = 'body_a';
    buildBodyGrid();
    showStep('body');
  }

  function goMirror() {
    if (!state.chosenBodyId) state.chosenBodyId = 'body_a';
    fillMirror();
    showStep('mirror');
  }

  function finish() {
    state.openingDone = true;
    if (!state.playerName) state.playerName = 'Saikoro';
    if (!state.chosenBodyId) state.chosenBodyId = 'body_a';
    if (!state.personal || typeof state.personal !== 'object') state.personal = {};
    if (!(state.personal[KEY_MIRROR_RESIDUE] > 0)) {
      state.personal[KEY_MIRROR_RESIDUE] = 1;
    }
    saveGame(state);
    setOverlayVisible(false);
    if (ui) ui.lastMsg = `welcome, ${state.playerName}`;
    render(state, ui);
    if (typeof opts.onDone === 'function') opts.onDone();
  }

  // Wire buttons (idempotent via replace)
  const btnNameNext = document.getElementById('opening-name-next');
  const btnBodyBack = document.getElementById('opening-body-back');
  const btnBodyNext = document.getElementById('opening-body-next');
  const btnMirrorBack = document.getElementById('opening-mirror-back');
  const btnEnter = document.getElementById('opening-enter');

  btnNameNext?.addEventListener('click', goBody);
  nameInput?.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      goBody();
    }
  });
  btnBodyBack?.addEventListener('click', goName);
  btnBodyNext?.addEventListener('click', goMirror);
  btnMirrorBack?.addEventListener('click', goBody);
  btnEnter?.addEventListener('click', finish);

  return {
    show() {
      setOverlayVisible(true);
      goName();
    },
    hide() {
      setOverlayVisible(false);
    },
    restart() {
      resetStateInPlace(state);
      setOverlayVisible(true);
      goName();
      render(state, ui);
    },
  };
}
