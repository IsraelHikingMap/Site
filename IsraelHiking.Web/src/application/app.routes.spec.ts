import { describe, it, expect } from "vitest";
import { commands } from "vitest/browser";

import { routes } from "./app.routes";
import { RouteStrings } from "./services/hash.service";

describe("App routes", () => {
    it("Should match the mapeak.com paths the Android app opens", async () => {
        const manifest = await commands.readFile("android/app/src/main/AndroidManifest.xml");
        const routePaths = routes
            .map(route => route.path)
            .filter(path => path !== "" && path !== "**");
        // The catch-all route shows the map, which is what these screens are
        const mapPaths = [RouteStrings.MAP, RouteStrings.SHARE, RouteStrings.POI, RouteStrings.URL, "layer"];
        const expected = ["/", ...[...routePaths, ...mapPaths].map(toPathPattern)];

        expect(getManifestPaths(manifest).sort()).toEqual(expected.sort());
    });
});

/**
 * An Angular route path as an Android path pattern: a parameter matches any segment, and the path may go on,
 * since a link can point deeper into the screen.
 */
function toPathPattern(path: string): string {
    return "/" + path.replace(/:[^/]+/g, ".*") + ".*";
}

function getManifestPaths(manifest: string): string[] {
    const document = new DOMParser().parseFromString(manifest, "application/xml");
    const mapeakFilter = [...document.getElementsByTagName("intent-filter")]
        .find(filter => [...filter.getElementsByTagName("data")].some(data => data.getAttribute("android:host") === "mapeak.com"));
    return [...mapeakFilter.getElementsByTagName("data")]
        .map(data => data.getAttribute("android:path") ?? data.getAttribute("android:pathPattern"))
        .filter(path => path != null);
}
