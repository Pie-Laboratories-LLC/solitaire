const path = require("path")

module.exports = {
  entry: path.resolve(__dirname, "./browser-entry.js"),
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "solitaire.js",
    // ESM, not UMD: this is meant to be `import()`-ed by an embedding page
    // (see mount() in browser-entry.js), not loaded via a <script> tag
    // relying on a global variable name that was never actually being set
    // (libraryTarget was "umd" with no output.library.name, so the
    // global-var fallback branch had nothing to attach to).
    library: { type: "module" },
    // "auto": resolves emitted asset URLs (see the asset/resource rule
    // below) relative to wherever this bundle is actually loaded from at
    // runtime (via import.meta.url for ESM output), not a path baked in at
    // build time -- needed since this gets embedded into another site
    // (currently: widgetgrid) at a path this repo has no reason to know.
    publicPath: "auto",
  },
  experiments: {
    outputModule: true,
  },
  module: {
    rules: [
      {
        test: /\.(js)$/,
        exclude: /node_modules/,
        use: "babel-loader",
      },
      {
        // Card back/face/background images -- emitted as separate
        // content-hashed files (not inlined: the card-face spritesheet
        // alone is ~900KB, which as a base64 data URI would bloat the JS
        // bundle by another third on every load instead of being a
        // separately cacheable file).
        test: /\.(png|jpe?g|svg)$/,
        type: "asset/resource",
      },
      {
        // The three game-dialog fragments (start/help/winner) -- imported
        // as raw strings (see solitaire-loader.js) instead of fetched at
        // runtime via axios, which used to mean anything embedding this
        // bundle also had to load axios globally and serve these files
        // itself at the right relative path.
        test: /\.html$/,
        type: "asset/source",
      },
    ],
  },
  mode: "production",
  // A real .map file, not inline eval: the default development devtool
  // uses eval(), which is exactly the kind of thing that trips CSPs in
  // whatever page ends up embedding this.
  devtool: "source-map",
}
