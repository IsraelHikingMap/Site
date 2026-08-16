import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
    test: {
        browser: {
            screenshotFailures: false
        }
    },
    resolve: {
        alias: {
            fflate: resolve(__dirname, "node_modules/fflate/esm/browser.js"),
            "piexif-ts": resolve(__dirname, "node_modules/piexif-ts/dist/piexif.js"),
        },
    }
});
