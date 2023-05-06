import { MockNgRedux, MockNgReduxModule } from "@angular-redux2/store/mocks";
import { TestBed, inject } from "@angular/core/testing";
import { RoutesFactory } from "./routes.factory";
import type { RouteData } from "../models/route-data";

describe("RoutesFactory", () => {
    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [
                MockNgReduxModule,
            ],
            providers: [
                RoutesFactory
            ]
        });
        MockNgRedux.reset();
    });

    it("Should create an empty route with the given name", inject([RoutesFactory], (factory: RoutesFactory) => {
        let routeEditingState = {
            opacity: 1,
            weight: 2,
        };
        MockNgRedux.store.getState = () => ({
            routeEditingState
        });

        let route = factory.createRouteData("hello");

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

    it("Should add missing data to a route", inject([RoutesFactory], (factory: RoutesFactory) => {
        let routeEditingState = {
            opacity: 1,
            weight: 2,
        };
        MockNgRedux.store.getState = () => ({
            routeEditingState
        });

        let route = {} as  RouteData;
        route = factory.createRouteDataAddMissingFields(route, "blue");
        expect(route.id).toBeDefined();
        expect(route.color).toBe("blue");
        expect(route.opacity).toBe(routeEditingState.opacity);
        expect(route.weight).toBe(routeEditingState.weight);
        expect(route.state).toBe("ReadOnly");
    }));

    it("Should do nothing if the list is empty", inject([RoutesFactory], (factory: RoutesFactory) => {
        let routes = [] as RouteData[];
        factory.regenerateDuplicateIds(routes);
        expect(routes).toEqual([]);
    }));

    it("Should do nothing if the list does not have duplicate ids", inject([RoutesFactory], (factory: RoutesFactory) => {
        let routes = [{id: "1"}, {id: "2"}] as RouteData[];
        factory.regenerateDuplicateIds(routes);
        expect(routes).toEqual([{id: "1"}, {id: "2"}] as RouteData[]);
    }));

    it("Should do regenerate id if the list has duplicate ids", inject([RoutesFactory], (factory: RoutesFactory) => {
        let routes = [{id: "1"}, {id: "2"}, {id: "1"}] as RouteData[];
        factory.regenerateDuplicateIds(routes);
        expect(routes[2].id).not.toBe("1");
    }));
});
