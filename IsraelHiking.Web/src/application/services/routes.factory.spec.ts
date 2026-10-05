import { describe, beforeEach, it, expect } from "vitest";
import { provideStore, Store } from "@ngxs/store";
import { TestBed, inject } from "@angular/core/testing";

import { RoutesFactory } from "./routes.factory";
import { RouteEditingReducer } from "../reducers/route-editing.reducer";
import type { RouteData } from "../models";

describe("RoutesFactory", () => {
    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                provideStore([RouteEditingReducer]),
                RoutesFactory
            ]
        });
    });

    it("Should create an empty route with the given name", inject([RoutesFactory, Store], (factory: RoutesFactory, store: Store) => {
        const routeEditingState = {
            opacity: 1,
            weight: 2
        };

        store.reset({
            routeEditingState
        });

        const route = factory.createRouteData("hello");

        expect(route.id).toBeDefined();
        expect(route.name).toBe("hello");
        expect(route.description).toBe("");
        expect(route.state).toBe("ReadOnly");
        expect(route.color).toBeDefined();
        expect(route.opacity).toBe(routeEditingState.opacity);
        expect(route.weight).toBe(routeEditingState.weight);
        expect(route.markers).toEqual([]);
        expect(route.segments).toEqual([]);
    }));

    it("Should add missing data to a route", inject([RoutesFactory, Store], (factory: RoutesFactory, store: Store) => {
        const routeEditingState = {
            opacity: 1,
            weight: 2
        };
        store.reset({
            routeEditingState
        });

        let route = {} as RouteData;
        route = factory.createRouteDataAddMissingFields(route, "blue");
        expect(route.id).toBeDefined();
        expect(route.color).toBe("blue");
        expect(route.opacity).toBe(routeEditingState.opacity);
        expect(route.weight).toBe(routeEditingState.weight);
        expect(route.state).toBe("ReadOnly");
    }));

    it("Should duplicate a route with a new id, a new id for every marker, the given name and color",
        inject([RoutesFactory], (factory: RoutesFactory) => {
            const route = {
                id: "1",
                name: "route",
                color: "blue",
                opacity: 1,
                weight: 2,
                state: "Route",
                markers: [{ id: "marker-1", title: "marker" }],
                segments: [{ routingType: "Hike" }]
            } as RouteData;

            const duplicated = factory.createDuplicateRouteData(route, "route 1", "red");

            expect(duplicated.id).not.toBe(route.id);
            expect(duplicated.name).toBe("route 1");
            expect(duplicated.color).toBe("red");
            expect(duplicated.opacity).toBe(route.opacity);
            expect(duplicated.weight).toBe(route.weight);
            expect(duplicated.markers[0].id).not.toBe(route.markers[0].id);
            expect(duplicated.markers[0].title).toBe(route.markers[0].title);
            expect(duplicated.segments).toEqual(route.segments);
            expect(route.markers[0].id).toBe("marker-1");
        }));

    it("Should do nothing if the list is empty", inject([RoutesFactory], (factory: RoutesFactory) => {
        const routes = [] as RouteData[];
        factory.regenerateDuplicateIds(routes);
        expect(routes).toEqual([]);
    }));

    it("Should do nothing if the list does not have duplicate ids", inject([RoutesFactory], (factory: RoutesFactory) => {
        const routes = [{ id: "1" }, { id: "2" }] as RouteData[];
        factory.regenerateDuplicateIds(routes);
        expect(routes).toEqual([{ id: "1" }, { id: "2" }] as RouteData[]);
    }));

    it("Should do regenerate id if the list has duplicate ids", inject([RoutesFactory], (factory: RoutesFactory) => {
        const routes = [{ id: "1" }, { id: "2" }, { id: "1" }] as RouteData[];
        factory.regenerateDuplicateIds(routes);
        expect(routes[2].id).not.toBe("1");
    }));

    it("should invert color to BW", inject([RoutesFactory], (factory: RoutesFactory) => {
        expect(factory.invertColorToBW("red")).toBe("#FFFFFF");
        expect(factory.invertColorToBW("yellow")).toBe("#000000");
        expect(factory.invertColorToBW("#ff0000")).toBe("#FFFFFF");
    }));
});
