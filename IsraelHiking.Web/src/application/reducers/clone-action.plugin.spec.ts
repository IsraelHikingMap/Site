import { describe, beforeEach, it, expect } from "vitest";
import { TestBed } from "@angular/core/testing";
import { provideStore, withNgxsPlugin, Store } from "@ngxs/store";

import { cloneActionPlugin } from "./clone-action.plugin";
import { RoutesReducer, AddRouteAction } from "./routes.reducer";
import type { ApplicationState, RouteData } from "../models";

describe("cloneActionPlugin", () => {
    let store: Store;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [provideStore([RoutesReducer], withNgxsPlugin(cloneActionPlugin))]
        });
        store = TestBed.inject(Store);
    });

    it("Should leave the dispatched object mutable", () => {
        const route = createRoute();

        store.dispatch(new AddRouteAction(route));

        expect(Object.isFrozen(route)).toBe(false);
        expect(() => route.markers.push({} as RouteData["markers"][0])).not.toThrow();
    });

    it("Should not let a later change to the dispatched object reach the state", () => {
        const route = createRoute();

        store.dispatch(new AddRouteAction(route));
        route.name = "changed";

        const stored = store.selectSnapshot((s: ApplicationState) => s.routes.present[0]);
        expect(stored.name).toBe("route");
        expect(stored).not.toBe(route);
    });
});

function createRoute(): RouteData {
    return {
        id: "1",
        name: "route",
        description: "",
        color: "blue",
        opacity: 1,
        weight: 1,
        state: "ReadOnly",
        markers: [],
        segments: []
    } as RouteData;
}
