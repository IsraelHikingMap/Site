import { inject, TestBed } from "@angular/core/testing";
import { NgxsModule, Store } from "@ngxs/store";
import { Subject } from "rxjs";

import { SelectedRouteService } from "./selected-route.service";
import { ResourcesService } from "./resources.service";
import { ToastServiceMockCreator } from "./toast.service.spec";
import { RouterService } from "./router.service";
import { RoutesFactory } from "./routes.factory";
import { SetSelectedRouteAction, RouteEditingReducer } from "../reducers/route-editing.reducer";
import { ToggleAddRecordingPoiAction } from "../reducers/recorded-route.reducer";
import { AddRouteAction, ChangeRouteStateAction, BulkReplaceRoutesAction, RoutesReducer } from "../reducers/routes.reducer";
import type { RouteData } from "../models/models";


describe("Selected Route Service", () => {
    const setupRoutes = (store: Store, routes: RouteData[]) => {
        store.dispatch(new BulkReplaceRoutesAction(routes));
    };

    const setupSelectedRoute = (store: Store, id: string) => {
        store.dispatch(new SetSelectedRouteAction(id));
    };

    beforeEach(() => {
        let toastMock = new ToastServiceMockCreator();
        toastMock.resourcesService.route = "route";
        let routerServiceMock = {};
        TestBed.configureTestingModule({
            imports: [
                NgxsModule.forRoot([RoutesReducer, RouteEditingReducer])
            ],
            providers: [
                { provide: ResourcesService, useValue: toastMock.resourcesService },
                { provide: RouterService, useValue: routerServiceMock },
                RoutesFactory,
                SelectedRouteService,
            ]
        });
    });

    it("Should get undefined selected route when there're no routes", inject([SelectedRouteService],
        (selectedRouteService: SelectedRouteService) => {
            let selectedRoute = selectedRouteService.getSelectedRoute();

            expect(selectedRoute).toBeUndefined();
        }
    ));

    it("Should sync selected route with editing route", inject([SelectedRouteService, Store],
        (selectedRouteService: SelectedRouteService, store: Store) => {
            store.dispatch = jasmine.createSpy();
            setupRoutes(store, [{ id: "42", state: "Poi" } as any]);
            setupSelectedRoute(store, "1");

            selectedRouteService.syncSelectedRouteWithEditingRoute();

            expect(store.dispatch).toHaveBeenCalled();
        }
    ));

    it("Should create a route when calling get or create and there are none", inject([SelectedRouteService, Store],
        (selectedRouteService: SelectedRouteService, store: Store) => {
            setupRoutes(store, []);
            store.reset({
                ...store.snapshot(),
                routeEditingState: {
                    opacity: 1,
                    weight: 10
                }
            });
            let spy = jasmine.createSpy();
            store.dispatch = spy;

            selectedRouteService.getOrCreateSelectedRoute();

            expect(spy).toHaveBeenCalled();
            expect(spy.calls.first().args[0]).toBeInstanceOf(AddRouteAction);
        }
    ));

    it("Should select the first route if selected route it null and there are routes", inject([SelectedRouteService, Store],
        (selectedRouteService: SelectedRouteService, store: Store) => {
            setupRoutes(store, [{id: "42"} as any]);
            setupSelectedRoute(store, null);

            const selectedRoute = selectedRouteService.getOrCreateSelectedRoute();

            expect(selectedRoute.id).toBe("42");
        }
    ));

    it("Should set selected route if there's no selected route", inject([SelectedRouteService, Store],
        (selectedRouteService: SelectedRouteService, store: Store) => {
            setupSelectedRoute(store, null);
            store.dispatch = jasmine.createSpy();

            selectedRouteService.setSelectedRoute("42");

            expect(store.dispatch).toHaveBeenCalled();
        }
    ));

    it("Should unselect selected route and selected the given route", inject([SelectedRouteService, Store],
        (selectedRouteService: SelectedRouteService, store: Store) => {
            setupSelectedRoute(store, "1");
            let spy = jasmine.createSpy();
            store.dispatch = spy;
            selectedRouteService.setSelectedRoute("42");

            expect(spy).toHaveBeenCalled();
            expect(spy.calls.first().args[0]).toBeInstanceOf(SetSelectedRouteAction);
        }
    ));

    it("Should return empty routes where there are none", inject([SelectedRouteService],
        (selectedRouteService: SelectedRouteService) => {
            expect(selectedRouteService.areRoutesEmpty()).toBeTruthy();
        }
    ));

    it("Should not return empty routes where there are routes", inject([SelectedRouteService, Store],
        (selectedRouteService: SelectedRouteService, store: Store) => {
            setupRoutes(store, [{id: "42"} as  any]);

            expect(selectedRouteService.areRoutesEmpty()).toBeFalsy();
        }
    ));

    it("Should change route edit state when not adding recorded POI", inject([SelectedRouteService, Store],
        (selectedRouteService: SelectedRouteService, store: Store) => {
            store.reset({
                recordedRouteState: {
                    isAddingPoi: false,
                }
            });
            let spy = jasmine.createSpy();
            store.dispatch = spy;

            selectedRouteService.changeRouteEditState("42", "ReadOnly");

            expect(spy).toHaveBeenCalled();
            expect(spy.calls.first().args[0]).toBeInstanceOf(ChangeRouteStateAction);
        }
    ));

    it("Should change route edit state when adding recorded POI", inject([SelectedRouteService, Store],
        (selectedRouteService: SelectedRouteService, store: Store) => {
            store.reset({
                recordedRouteState: {
                    isAddingPoi: true,
                }
            });
            let spy = jasmine.createSpy();
            store.dispatch = spy;

            selectedRouteService.changeRouteEditState("42", "ReadOnly");

            expect(spy).toHaveBeenCalled();
            expect(spy.calls.all()[0].args[0]).toBeInstanceOf(ToggleAddRecordingPoiAction);
            expect(spy.calls.all()[1].args[0]).toBeInstanceOf(ChangeRouteStateAction);
        }
    ));

    it("Should create route name when there's a route with that name", inject([SelectedRouteService, Store],
        (selectedRouteService: SelectedRouteService, store: Store) => {
            let routeName = selectedRouteService.createRouteName();
            setupRoutes(store, [{id: "42", name: routeName} as any]);

            expect(selectedRouteService.createRouteName()).not.toBe(routeName);
            expect(selectedRouteService.isNameAvailable(routeName)).toBeFalsy();
        }
    ));

    it("Should get closet route to selected route when there are no other routes", inject([SelectedRouteService, Store],
        (selectedRouteService: SelectedRouteService, store: Store) => {
            setupRoutes(store, [{
                id: "1",
                description: "",
                markers: [],
                name: "name",
                segments: [{
                    latlngs: [{lat: 1, lng: 1, timestamp: new Date()}],
                    routePoint: {lat: 1, lng: 1},
                    routingType: "Hike"
                }],
                state: "ReadOnly",
            }]);
            setupSelectedRoute(store, "1");

            const closetRoute = selectedRouteService.getClosestRouteToSelected(true);
            expect(closetRoute).toBeNull();
        }
    ));

    it("Should get closet route to selected route when there is another route", inject([SelectedRouteService, Store],
        (selectedRouteService: SelectedRouteService, store: Store) => {
            setupRoutes(store, [{
                id: "1",
                description: "",
                markers: [],
                name: "name",
                segments: [{
                    latlngs: [{lat: 1, lng: 1, timestamp: new Date()}],
                    routePoint: {lat: 1, lng: 1},
                    routingType: "Hike"
                }],
                state: "ReadOnly",
            }, {
                id: "2",
                description: "",
                markers: [],
                name: "name",
                segments: [{
                    latlngs: [{lat: 1.00001, lng: 1.00001, timestamp: new Date()}],
                    routePoint: {lat: 1, lng: 1},
                    routingType: "Hike"
                }],
                state: "ReadOnly",
            }]);
            setupSelectedRoute(store, "1");

            const closetRoute = selectedRouteService.getClosestRouteToSelected(true);
            expect(closetRoute.id).toBe("2");
        }
    ));

    it("Should get closet route to selected route when there are other routes and it is near the end of the route",
        inject([SelectedRouteService, Store],
        (selectedRouteService: SelectedRouteService, store: Store) => {
            setupRoutes(store, [{
                id: "1",
                description: "",
                markers: [],
                name: "name",
                segments: [{
                    latlngs: [{lat: 1, lng: 1, timestamp: new Date()}],
                    routePoint: {lat: 1, lng: 1},
                    routingType: "Hike"
                }],
                state: "ReadOnly",
            }, {
                id: "2",
                description: "",
                markers: [],
                name: "name",
                segments: [{
                    latlngs: [{lat: 2, lng: 2, timestamp: new Date()}],
                    routePoint: {lat: 2, lng: 2},
                    routingType: "Hike"
                }],
                state: "ReadOnly",
            },
            {
                id: "3",
                description: "",
                markers: [],
                name: "name",
                segments: [{
                    latlngs: [
                        {lat: 2, lng: 2, timestamp: new Date()},
                        {lat: 1, lng: 1, timestamp: new Date()}
                    ],
                    routePoint: {lat: 2, lng: 2},
                    routingType: "Hike"
                }],
                state: "ReadOnly",
            }]);
            setupSelectedRoute(store, "1");

            const closetRoute = selectedRouteService.getClosestRouteToSelected(false);
            expect(closetRoute.id).toBe("3");
        }
    ));

    it("Should not get closet route to GPS when there's no location", inject([SelectedRouteService, Store],
        (selectedRouteService: SelectedRouteService, store: Store) => {
            setupRoutes(store, []);

            const closetRoute = selectedRouteService.getClosestRouteToGPS(null, null);
            expect(closetRoute).toBeNull();
        }
    ));

    it("Should not get closet route to GPS when there are no routes", inject([SelectedRouteService, Store],
        (selectedRouteService: SelectedRouteService, store: Store) => {
            setupRoutes(store, []);

            const closetRoute = selectedRouteService.getClosestRouteToGPS({ lat: 1, lng: 1, timestamp: new Date()}, 0);
            expect(closetRoute).toBeNull();
        }
    ));

    it("Should not get closet route to GPS when there are no visible routes", inject([SelectedRouteService, Store],
        (selectedRouteService: SelectedRouteService, store: Store) => {
            setupRoutes(store, [{
                id: "1",
                description: "",
                markers: [],
                name: "name",
                segments: [{
                    latlngs: [{lat: 1, lng: 1, timestamp: new Date()}],
                    routePoint: {lat: 1, lng: 1},
                    routingType: "Hike"
                }],
                state: "Hidden",
            }]);

            const closetRoute = selectedRouteService.getClosestRouteToGPS({ lat: 1, lng: 1, timestamp: new Date()}, 0);
            expect(closetRoute).toBeNull();
        }
    ));

    it("Should get closet route to GPS when there are routes", inject([SelectedRouteService, Store],
        (selectedRouteService: SelectedRouteService, store: Store) => {
            setupRoutes(store, [{
                id: "1",
                description: "",
                markers: [],
                name: "name",
                segments: [{
                    latlngs: [{lat: 1, lng: 1, timestamp: new Date()},
                        {lat: 2, lng: 2, timestamp: new Date()}],
                    routePoint: {lat: 1, lng: 1},
                    routingType: "Hike"
                }],
                state: "ReadOnly",
            }]);

            const closetRoute = selectedRouteService.getClosestRouteToGPS({ lat: 1, lng: 1, timestamp: new Date()}, 0);
            expect(closetRoute.id).toBe("1");
        }
    ));
});
