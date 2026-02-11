import type { ModuleOptions } from "webpack";

const commonRules: Required<ModuleOptions>["rules"] = [
  {
    test: /\.tsx?$/,
    exclude: /(node_modules|\.webpack)/,
    use: {
      loader: "ts-loader",
      options: {
        transpileOnly: true,
      },
    },
  },
];

export const mainRules: Required<ModuleOptions>["rules"] = [
  {
    test: /native_modules[/\\].+\.node$/,
    use: "node-loader",
  },
  {
    test: /[/\\]node_modules[/\\].+\.(m?js|node)$/,
    parser: { amd: false },
    use: {
      loader: "@vercel/webpack-asset-relocator-loader",
      options: {
        outputAssetBase: "native_modules",
      },
    },
  },
  ...commonRules,
];

export const rendererRules: Required<ModuleOptions>["rules"] = [...commonRules];

// For backward compatibility if needed, but we should update imports
export const rules = mainRules;
