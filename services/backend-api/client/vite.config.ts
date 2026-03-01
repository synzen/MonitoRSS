/// <reference types="vitest/config" />
/// <reference types="vitest" />
import { sentryVitePlugin } from "@sentry/vite-plugin";
import { defineConfig, ProxyOptions } from "vite";
import react from "@vitejs/plugin-react-swc";
import { resolve } from "path";

const VITE_ENV = process.env.ENV || "development";

// Docker-specific configurations
const API_PROXY_URL = process.env.API_PROXY_URL || "http://localhost:8000";
// Cannot get non-polling to work with Docker, so this is a workaround
const VITE_USE_POLLING = Boolean(process.env.VITE_USE_POLLING) || false;
const proxyOptionsByEnv: Record<string, Record<string, ProxyOptions>> = {
  development: {
    "/api": {
      target: API_PROXY_URL,
      changeOrigin: true,
    },
  },
  production: {
    "/api": {
      target: "https://my.monitorss.xyz",
      changeOrigin: true,
    },
  },
};

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      release: {
        name: process.env.SENTRY_RELEASE,
      },
      telemetry: !process.env.CI,
    }),
  ],
  publicDir: "./public",
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  server: {
    proxy: proxyOptionsByEnv[VITE_ENV] || {},
    watch: {
      usePolling: VITE_USE_POLLING,
    },
    port: 3000,
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/highlight.js/")) {
            return "vendor-hljs";
          }
          if (
            id.includes("node_modules/@chakra-ui/") ||
            id.includes("node_modules/@emotion/") ||
            id.includes("node_modules/framer-motion")
          ) {
            return "vendor-chakra";
          }
          if (id.includes("node_modules/@sentry/")) {
            return "vendor-sentry";
          }
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/") ||
            id.includes("node_modules/react-router")
          ) {
            return "vendor-react";
          }
        },
      },
    },
  },
  test: {
    setupFiles: ["setupTests.ts"],
    globals: true,
    environment: "happy-dom",
  },
});
