import { Configuration, ProvidePlugin, DefinePlugin } from "webpack";

import { rendererRules as rules } from "./webpack.rules";
import { plugins } from "./webpack.plugins";
import MonacoWebpackPlugin from "monaco-editor-webpack-plugin";

rules.push({
  test: /\.css$/,
  use: [{ loader: "style-loader" }, { loader: "css-loader" }],
});

export const rendererConfig: Configuration = {
  module: {
    rules,
  },
  plugins: [
    ...plugins,
    new MonacoWebpackPlugin({
      languages: [
        "javascript",
        "typescript",
        "css",
        "html",
        "json",
        "markdown",
        "python",
      ],
    }),
    new ProvidePlugin({
      process: "process/browser",
      Buffer: ["buffer", "Buffer"],
    }),
    new DefinePlugin({
      __dirname: JSON.stringify("/"),
      __filename: JSON.stringify("/index.html"),
    }),
  ],
  resolve: {
    extensions: [".js", ".ts", ".jsx", ".tsx", ".css"],
    fallback: {
      path: require.resolve("path-browserify"),
      fs: false,
      process: require.resolve("process/browser"),
    },
  },
  node: {
    __dirname: true,
  },
};
