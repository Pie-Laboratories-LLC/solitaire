# RUN DOCKER FOR WEB VERSION

```bash
$ docker run --name solitaire -p 8081:80 -v 'c:/cygwin64/home/mattc/GIT/solitaire':/usr/share/nginx/html:ro -d --rm nginx
```

Then visit `solitaire-index.html` -- it loads `solitaire-loader.js` directly
as a native ES module, no build needed. This is the "just play it" path.

# EMBEDDING IT IN ANOTHER SITE

`npm run build` produces `dist/solitaire.js`, a self-contained ES module
(images, card face spritesheet, and the three dialog HTML fragments are all
bundled in -- nothing extra to serve or load globally). It exports one
function:

```js
import { mount } from './dist/solitaire.js';
mount(containerElement);
```

`containerElement` needs the same structure `solitaire-index.html`'s
`#solitaire` div has: `.canvas-container` with one `<canvas>` inside,
`.controls`, `.credits`, and `.overlay.game-dialog` / `.overlay.error-dialog`
each with an `.x-bar` and `.content`. Easiest to just copy that div's markup
from `solitaire-index.html`. Also load `solitaire.css` -- its selectors are
scoped to `#solitaire`, so keep that id on the container.

Currently embedded in `widgetgrid` (`widgets/solitaire/`), which vendors
this repo's `dist/` output at build time -- see that widget's
`scripts/vendor-solitaire.mjs`.

# OTHER CREDITs

* [background image](https://www.gameartguppy.com/tutorial-how-to-create-a-seamless-texture-in-gimp/)
