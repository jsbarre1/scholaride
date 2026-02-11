import type { Configuration } from "webpack";

import { mainRules as rules } from "./webpack.rules";
import { plugins } from "./webpack.plugins";

export const mainConfig: Configuration = {
  /**
   * This is the main entry point for your application, it's the first file
   * that runs in the main process.
   */
  entry: "./src/main/main.ts",
  // Put your normal webpack config below here
  module: {
    rules,
  },
  plugins,
  resolve: {
    extensions: [".js", ".ts", ".jsx", ".tsx", ".css", ".json"],
  },
  externals: {
    "node-pty": "commonjs node-pty",
  },
  node: {
    __dirname: false,
    __filename: false,
  },
};
