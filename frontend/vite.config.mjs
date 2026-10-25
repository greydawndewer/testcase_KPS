import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";

const require = createRequire(import.meta.url);
const babel = require("@babel/core");
const express = require("express");
const babelMetadataPlugin = require("./plugins/visual-edits/babel-metadata-plugin.js");
const setupVisualEditServer = require("./plugins/visual-edits/dev-server-setup.js");
const createViteHealthPlugin = require("./plugins/health-check/vite-health-plugin.js");
const projectRoot = fileURLToPath(new URL(".", import.meta.url));

function visualMetadataPlugin() {
  return {
    name: "ssms-visual-edit-metadata",
    enforce: "pre",
    transform(code, id) {
      const filePath = id.split("?")[0].replace(/\\/g, "/");
      if (!filePath.includes("/src/") || !/\.[jt]sx?$/.test(filePath)) {
        return null;
      }

      const transformed = babel.transformSync(code, {
        filename: filePath,
        babelrc: false,
        configFile: false,
        parserOpts: {
          sourceType: "module",
          plugins: ["jsx"],
        },
        plugins: [babelMetadataPlugin],
        sourceMaps: true,
      });

      if (!transformed) {
        throw new Error(`Babel did not transform ${filePath}`);
      }

      return { code: transformed.code, map: transformed.map };
    },
  };
}

function visualEditServerPlugin() {
  return {
    name: "ssms-visual-edit-server",
    configureServer(server) {
      const app = express();
      const setup = setupVisualEditServer({});
      setup.setupMiddlewares([], { app });
      app.use((_request, _response, next) => next());
      server.middlewares.use(app);
    },
  };
}

function htmlEnvironmentPlugin(enableVisualEdits) {
  return {
    name: "ssms-html-environment",
    transformIndexHtml(html) {
      return html.replaceAll(
        "%REACT_APP_ENABLE_VISUAL_EDITS%",
        String(enableVisualEdits),
      );
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, projectRoot, "");
  const enableVisualEdits = env.REACT_APP_ENABLE_VISUAL_EDITS === "true";
  const enableHealthCheck = env.ENABLE_HEALTH_CHECK === "true";

  return {
    envPrefix: ["VITE_", "REACT_APP_"],
    resolve: {
      alias: {
        "@": path.resolve(projectRoot, "src"),
      },
    },
    plugins: [
      ...(enableVisualEdits ? [visualMetadataPlugin()] : []),
      react(),
      tailwindcss(),
      htmlEnvironmentPlugin(enableVisualEdits),
      ...(enableVisualEdits ? [visualEditServerPlugin()] : []),
      ...(enableHealthCheck ? [createViteHealthPlugin()] : []),
    ],
    server: {
      port: 3000,
      ...(env.DISABLE_HOT_RELOAD === "true" ? { hmr: false } : {}),
    },
    build: {
      outDir: "build",
      emptyOutDir: true,
    },
  };
});
