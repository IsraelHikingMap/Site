import { defineConfig } from "vitest/config";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import { resolve } from "path";

export default defineConfig({
    plugins: [
        nodePolyfills({
            include: ["stream", "timers", "events", "buffer", "string_decoder"],
            exclude: ["module"],
        }),
    ],
    resolve: {
        alias: {
            fflate: resolve(__dirname, "node_modules/fflate/esm/browser.js"),
            "piexif-ts": resolve(__dirname, "node_modules/piexif-ts/dist/piexif.js"),
        },
    }
});
