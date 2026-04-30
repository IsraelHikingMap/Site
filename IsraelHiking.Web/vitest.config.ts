import { defineConfig } from "vitest/config";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
  plugins: [
    nodePolyfills({
      include: ["stream", "timers", "events", "buffer", "string_decoder"],
      exclude: ["module"],
    }),
  ],
  resolve: {
    alias: {
      // fflate's ESM node entry uses createRequire which doesn't exist in browser.
      // Force Vite to use the browser-specific build instead.
      fflate: "fflate/esm/browser.js",
    },
  },
});
