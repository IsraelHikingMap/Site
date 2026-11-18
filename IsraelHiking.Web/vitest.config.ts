import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
    test: {
        isolate: true,
        browser: {
            screenshotFailures: false
        }
    },
    resolve: {
        alias: {
            fflate: resolve(import.meta.dirname, "node_modules/fflate/esm/browser.js"),
            "piexif-ts": resolve(import.meta.dirname, "node_modules/piexif-ts/dist/piexif.js"),
        },
    }
});
