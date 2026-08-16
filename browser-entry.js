import SolitaireLoader from './solitaire-loader.js';

// container: the element to mount the game into (its .canvas-container,
// .controls, .game-dialog, .error-dialog structure -- see
// solitaire-index.html for the exact shape expected). Falls back to
// document.getElementById('solitaire') if omitted, for the standalone demo.
export function mount(container) {
    new SolitaireLoader(container);
}
