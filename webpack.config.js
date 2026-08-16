const path = require("path")

module.exports = {
  entry: path.resolve(__dirname, "./crappy-browser-crap.js"),
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "crappy-browser-bundle.js",
    libraryTarget: "umd",
  },
  module: {
    rules: [
      {
        test: /\.(js)$/,
        exclude: /node_modules/,
        use: "babel-loader",
      },
    ],
  },
  mode: "development",
}
