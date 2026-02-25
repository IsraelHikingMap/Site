import { NgxsModule, Store } from "@ngxs/store";
import { TestBed, inject } from "@angular/core/testing";

import { RoutesFactory } from "./routes.factory";
import { RouteEditingReducer } from "../reducers/route-editing.reducer";
import type { RouteData } from "../models";

describe("RoutesFactory", () => {
    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [
                NgxsModule.forRoot([RouteEditingReducer])
            ],
            providers: [
                RoutesFactory
            ]
        });
    });

    it("Should create an empty route with the given name", inject([RoutesFactory, Store], (factory: RoutesFactory, store: Store) => {
        const routeEditingState = {
            opacity: 1,
            weight: 2,
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
            weight: 2,
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
