import { inject, TestBed } from "@angular/core/testing";
import { NgxsModule, Store } from "@ngxs/store";

import { SelectedRouteService } from "./selected-route.service";
import { ResourcesService } from "./resources.service";
import { RoutingProvider } from "./routing.provider";
import { RoutesFactory } from "./routes.factory";
import { SetSelectedRouteAction, RouteEditingReducer } from "../reducers/route-editing.reducer";
import { ToggleAddRecordingPoiAction } from "../reducers/recorded-route.reducer";
import { AddRouteAction, ChangeRouteStateAction, BulkReplaceRoutesAction, RoutesReducer, MergeRoutesAction, SplitRouteAction, ReplaceRouteAction, UpdateSegmentsAction, DeleteSegmentAction, ReplaceSegmentsAction, AddPrivatePoiAction } from "../reducers/routes.reducer";
import type { RouteData } from "../models";


describe("Selected Route Service", () => {
    const setupRoutes = (store: Store, routes: RouteData[]) => {
        store.dispatch(new BulkReplaceRoutesAction(routes));
    };

    const setupSelectedRoute = (store: Store, id: string) => {
        store.dispatch(new SetSelectedRouteAction(id));
    };

    beforeEach(() => {
        const resourceService = {
            route: "route",
            split: "split"
        };
        const routingProviderMock = {
            getRoute: () => Promise.resolve([])
        };
        TestBed.configureTestingModule({
            imports: [
                NgxsModule.forRoot([RoutesReducer, RouteEditingReducer])
            ],
            providers: [
                { provide: ResourcesService, useValue: resourceService },
                { provide: RoutingProvider, useValue: routingProviderMock },
                RoutesFactory,
                SelectedRouteService,
            ]
        });
    });

    it("Should get undefined selected route when there're no routes", inject([SelectedRouteService],
        (selectedRouteService: SelectedRouteService) => {
            const selectedRoute = selectedRouteService.getSelectedRoute();

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
            const spy = jasmine.createSpy();
            store.dispatch = spy;

            selectedRouteService.getOrCreateSelectedRoute();

            expect(spy).toHaveBeenCalled();
            expect(spy.calls.first().args[0]).toBeInstanceOf(AddRouteAction);
        }
    ));

    it("Should select the first route if selected route it null and there are routes", inject([SelectedRouteService, Store],
        (selectedRouteService: SelectedRouteService, store: Store) => {
            setupRoutes(store, [{ id: "42" } as any]);
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
            const spy = jasmine.createSpy();
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
            setupRoutes(store, [{ id: "42" } as any]);

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
            const spy = jasmine.createSpy();
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
            const spy = jasmine.createSpy();
            store.dispatch = spy;

            selectedRouteService.changeRouteEditState("42", "ReadOnly");

            expect(spy).toHaveBeenCalled();
            expect(spy.calls.all()[0].args[0]).toBeInstanceOf(ToggleAddRecordingPoiAction);
            expect(spy.calls.all()[1].args[0]).toBeInstanceOf(ChangeRouteStateAction);
        }
    ));

    it("Should create route name when there's a route with that name", inject([SelectedRouteService, Store],
        (selectedRouteService: SelectedRouteService, store: Store) => {
            const routeName = selectedRouteService.createRouteName();
            setupRoutes(store, [{ id: "42", name: routeName } as any]);

            expect(selectedRouteService.createRouteName()).not.toBe(routeName);
            expect(selectedRouteService.isNameAvailable(routeName)).toBeFalsy();
        }
    ));

    it("Should not get closet route to selected route when there are no other routes", inject([SelectedRouteService, Store],
        (selectedRouteService: SelectedRouteService, store: Store) => {
            setupRoutes(store, [{
                id: "1",
                description: "",
                markers: [],
                name: "name",
                segments: [{
                    latlngs: [{ lat: 1, lng: 1, timestamp: new Date() }],
                    routePoint: { lat: 1, lng: 1 },
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
                    latlngs: [{ lat: 1, lng: 1, timestamp: new Date() }],
                    routePoint: { lat: 1, lng: 1 },
                    routingType: "Hike"
                }],
                state: "ReadOnly",
            }, {
                id: "2",
                description: "",
                markers: [],
                name: "name",
                segments: [{
                    latlngs: [{ lat: 1.00001, lng: 1.00001, timestamp: new Date() }],
                    routePoint: { lat: 1, lng: 1 },
                    routingType: "Hike"
                }],
                state: "ReadOnly",
            }]);
            setupSelectedRoute(store, "1");

            const closetRoute = selectedRouteService.getClosestRouteToSelected(true);
            expect(closetRoute.id).toBe("2");
        }
    ));

    it("Should get the closet route to selected route when there are multiple close by routes", inject([SelectedRouteService, Store],
        (selectedRouteService: SelectedRouteService, store: Store) => {
            setupRoutes(store, [{
                id: "1",
                description: "",
                markers: [],
                name: "name",
                segments: [{
                    latlngs: [{ lat: 1, lng: 1, timestamp: new Date() }],
                    routePoint: { lat: 1, lng: 1 },
                    routingType: "Hike"
                }],
                state: "ReadOnly",
            }, {
                id: "2",
                description: "",
                markers: [],
                name: "clost but not the closest",
                segments: [{
                    latlngs: [{ lat: 1.00001, lng: 1.00001, timestamp: new Date() }],
                    routePoint: { lat: 1, lng: 1 },
                    routingType: "Hike"
                }],
                state: "ReadOnly",
            }, {
                id: "3",
                description: "",
                markers: [],
                name: "closest",
                segments: [{
                    latlngs: [{ lat: 1.00001, lng: 1, timestamp: new Date() }],
                    routePoint: { lat: 1, lng: 1 },
                    routingType: "Hike"
                }],
                state: "ReadOnly",
            }
            ]);
            setupSelectedRoute(store, "1");

            const closetRoute = selectedRouteService.getClosestRouteToSelected(true);
            expect(closetRoute.id).toBe("3");
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
                        latlngs: [{ lat: 1, lng: 1, timestamp: new Date() }],
                        routePoint: { lat: 1, lng: 1 },
                        routingType: "Hike"
                    }],
                    state: "ReadOnly",
                }, {
                    id: "2",
                    description: "",
                    markers: [],
                    name: "name",
                    segments: [{
                        latlngs: [{ lat: 2, lng: 2, timestamp: new Date() }],
                        routePoint: { lat: 2, lng: 2 },
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
                            { lat: 2, lng: 2, timestamp: new Date() },
                            { lat: 1, lng: 1, timestamp: new Date() }
                        ],
                        routePoint: { lat: 2, lng: 2 },
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

            const closetRoute = selectedRouteService.getClosestRouteToGPS({ lat: 1, lng: 1, timestamp: new Date() }, 0);
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
                    latlngs: [{ lat: 1, lng: 1, timestamp: new Date() }],
                    routePoint: { lat: 1, lng: 1 },
                    routingType: "Hike"
                }],
                state: "Hidden",
            }]);

            const closetRoute = selectedRouteService.getClosestRouteToGPS({ lat: 1, lng: 1, timestamp: new Date() }, 0);
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
                    latlngs: [{ lat: 1, lng: 1, timestamp: new Date() },
                    { lat: 2, lng: 2, timestamp: new Date() }],
                    routePoint: { lat: 1, lng: 1 },
                    routingType: "Hike"
                }],
                state: "ReadOnly",
            }]);

            const closetRoute = selectedRouteService.getClosestRouteToGPS({ lat: 1, lng: 1, timestamp: new Date() }, 0);
            expect(closetRoute.id).toBe("1");
        }
    ));

    it("Should get closet route to GPS when there are routes when heading is opposite", inject([SelectedRouteService, Store],
        (selectedRouteService: SelectedRouteService, store: Store) => {
            setupRoutes(store, [{
                id: "1",
                description: "",
                markers: [],
                name: "name",
                segments: [{
                    latlngs: [{ lat: 1, lng: 1, timestamp: new Date() },
                    { lat: 1, lng: 0, timestamp: new Date() }],
                    routePoint: { lat: 1, lng: 1 },
                    routingType: "Hike"
                }],
                state: "ReadOnly",
            }]);
            const closetRoute = selectedRouteService.getClosestRouteToGPS({ lat: 1.0001, lng: 1, timestamp: new Date() }, 90);
            expect(closetRoute.id).toBe("1");
        }
    ));

    it("Should split a route at the middle and add 'split' to name", inject([SelectedRouteService, Store],
        (selectedRouteService: SelectedRouteService, store: Store) => {
            setupRoutes(store, [{
                id: "1",
                description: "",
                markers: [],
                name: "name",
                segments: [{
                    latlngs: [
                        { lat: 1, lng: 1, timestamp: new Date() },
                        { lat: 1, lng: 1, timestamp: new Date() }
                    ],
                    routePoint: { lat: 1, lng: 1 },
                    routingType: "Hike"
                }, {
                    latlngs: [
                        { lat: 1, lng: 1, timestamp: new Date() },
                        { lat: 2, lng: 2, timestamp: new Date() }
                    ],
                    routePoint: { lat: 2, lng: 2 },
                    routingType: "Hike"
                }, {
                    latlngs: [
                        { lat: 2, lng: 2, timestamp: new Date() },
                        { lat: 3, lng: 3, timestamp: new Date() }
                    ],
                    routePoint: { lat: 3, lng: 3 },
                    routingType: "Hike"
                }],
                state: "ReadOnly",
            }]);
            setupSelectedRoute(store, "1");

            const spy = jasmine.createSpy();
            store.dispatch = spy;

            selectedRouteService.splitRoute(1);

            expect(spy.calls.all()[0].args[0]).toBeInstanceOf(SplitRouteAction);
            const action = spy.calls.all()[0].args[0] as SplitRouteAction;
            expect(action.routeId).toBe("1");
            expect(action.routeData.segments.length).toBe(2);
            expect(action.routeData.segments[0].latlngs[0].lat).toBe(1);
            expect(action.routeData.segments[0].latlngs[1].lat).toBe(1);
            expect(action.routeData.segments[1].latlngs[1].lat).toBe(2);
            expect(action.splitRouteData.name).toBe("name split");
            expect(action.splitRouteData.segments.length).toBe(2);
            expect(action.splitRouteData.segments[0].latlngs[0].lat).toBe(2);
            expect(action.splitRouteData.segments[0].latlngs[1].lat).toBe(2);
            expect(action.splitRouteData.segments[1].latlngs[1].lat).toBe(3);
        }));

    it("Should split a route at the middle and add not split word", inject([SelectedRouteService, Store],
        (selectedRouteService: SelectedRouteService, store: Store) => {
            setupRoutes(store, [{
                id: "1",
                description: "",
                markers: [],
                name: "name split 1",
                segments: [{
                    latlngs: [
                        { lat: 1, lng: 1, timestamp: new Date() },
                        { lat: 1, lng: 1, timestamp: new Date() }
                    ],
                    routePoint: { lat: 1, lng: 1 },
                    routingType: "Hike"
                }, {
                    latlngs: [
                        { lat: 1, lng: 1, timestamp: new Date() },
                        { lat: 2, lng: 2, timestamp: new Date() }
                    ],
                    routePoint: { lat: 2, lng: 2 },
                    routingType: "Hike"
                }, {
                    latlngs: [
                        { lat: 2, lng: 2, timestamp: new Date() },
                        { lat: 3, lng: 3, timestamp: new Date() }
                    ],
                    routePoint: { lat: 3, lng: 3 },
                    routingType: "Hike"
                }],
                state: "ReadOnly",
            }]);
            setupSelectedRoute(store, "1");

            const spy = jasmine.createSpy();
            store.dispatch = spy;

            selectedRouteService.splitRoute(1);

            expect(spy.calls.all()[0].args[0]).toBeInstanceOf(SplitRouteAction);
            const action = spy.calls.all()[0].args[0] as SplitRouteAction;
            expect(action.splitRouteData.name).toBe("name split 2");
        }));

    it("Should merge routes with the same direction", inject([SelectedRouteService, Store],
        (selectedRouteService: SelectedRouteService, store: Store) => {
            setupRoutes(store, [{
                id: "1",
                description: "",
                markers: [],
                name: "name",
                segments: [{
                    latlngs: [
                        { lat: 1, lng: 1, timestamp: new Date() },
                        { lat: 1, lng: 1, timestamp: new Date() }
                    ],
                    routePoint: { lat: 1, lng: 1 },
                    routingType: "Hike"
                }, {
                    latlngs: [
                        { lat: 1, lng: 1, timestamp: new Date() },
                        { lat: 2, lng: 2, timestamp: new Date() }
                    ],
                    routePoint: { lat: 2, lng: 2 },
                    routingType: "Hike"
                }],
                state: "ReadOnly",
            }, {
                id: "2",
                description: "",
                markers: [],
                name: "name",
                segments: [{
                    latlngs: [
                        { lat: 2, lng: 2, timestamp: new Date() },
                        { lat: 2, lng: 2, timestamp: new Date() }
                    ],
                    routePoint: { lat: 2, lng: 2 },
                    routingType: "Hike"
                }, {
                    latlngs: [
                        { lat: 2, lng: 2, timestamp: new Date() },
                        { lat: 3, lng: 3, timestamp: new Date() }
                    ],
                    routePoint: { lat: 3, lng: 3 },
                    routingType: "Hike"
                }],
                state: "ReadOnly",
            }]);
            setupSelectedRoute(store, "1");

            const spy = jasmine.createSpy();
            store.dispatch = spy;

            selectedRouteService.mergeRoutes(false);

            expect(spy.calls.all()[0].args[0]).toBeInstanceOf(MergeRoutesAction);
            expect(spy.calls.all()[0].args[0].mergedRouteData.segments.length).toBe(3);
            expect(spy.calls.all()[0].args[0].mergedRouteData.segments[0].latlngs[0].lat).toBe(1);
            expect(spy.calls.all()[0].args[0].mergedRouteData.segments[2].latlngs[1].lat).toBe(3);
        }));

    it("Should merge routes with the same direction when selected route is second", inject([SelectedRouteService, Store],
        (selectedRouteService: SelectedRouteService, store: Store) => {
            setupRoutes(store, [{
                id: "1",
                description: "",
                markers: [],
                name: "name",
                segments: [{
                    latlngs: [
                        { lat: 1, lng: 1, timestamp: new Date() },
                        { lat: 1, lng: 1, timestamp: new Date() }
                    ],
                    routePoint: { lat: 1, lng: 1 },
                    routingType: "Hike"
                }, {
                    latlngs: [
                        { lat: 1, lng: 1, timestamp: new Date() },
                        { lat: 2, lng: 2, timestamp: new Date() }
                    ],
                    routePoint: { lat: 2, lng: 2 },
                    routingType: "Hike"
                }],
                state: "ReadOnly",
            }, {
                id: "2",
                description: "",
                markers: [],
                name: "name",
                segments: [{
                    latlngs: [
                        { lat: 2, lng: 2, timestamp: new Date() },
                        { lat: 2, lng: 2, timestamp: new Date() }
                    ],
                    routePoint: { lat: 2, lng: 2 },
                    routingType: "Hike"
                }, {
                    latlngs: [
                        { lat: 2, lng: 2, timestamp: new Date() },
                        { lat: 3, lng: 3, timestamp: new Date() }
                    ],
                    routePoint: { lat: 3, lng: 3 },
                    routingType: "Hike"
                }],
                state: "ReadOnly",
            }]);
            setupSelectedRoute(store, "2");

            const spy = jasmine.createSpy();
            store.dispatch = spy;

            selectedRouteService.mergeRoutes(true);

            expect(spy.calls.all()[0].args[0]).toBeInstanceOf(MergeRoutesAction);
            expect(spy.calls.all()[0].args[0].mergedRouteData.segments.length).toBe(3);
            expect(spy.calls.all()[0].args[0].mergedRouteData.segments[0].latlngs[0].lat).toBe(1);
            expect(spy.calls.all()[0].args[0].mergedRouteData.segments[2].latlngs[1].lat).toBe(3);
        }));

    it("Should merge routes with oposite direction", inject([SelectedRouteService, Store],
        (selectedRouteService: SelectedRouteService, store: Store) => {
            setupRoutes(store, [{
                id: "1",
                description: "",
                markers: [],
                name: "name",
                segments: [{
                    latlngs: [
                        { lat: 1, lng: 1, timestamp: new Date() },
                        { lat: 1, lng: 1, timestamp: new Date() }
                    ],
                    routePoint: { lat: 1, lng: 1 },
                    routingType: "Hike"
                }, {
                    latlngs: [
                        { lat: 1, lng: 1, timestamp: new Date() },
                        { lat: 2, lng: 2, timestamp: new Date() }
                    ],
                    routePoint: { lat: 2, lng: 2 },
                    routingType: "Hike"
                }],
                state: "ReadOnly",
            }, {
                id: "2",
                description: "",
                markers: [],
                name: "name",
                segments: [{
                    latlngs: [
                        { lat: 3, lng: 3, timestamp: new Date() },
                        { lat: 3, lng: 3, timestamp: new Date() }
                    ],
                    routePoint: { lat: 3, lng: 3 },
                    routingType: "Hike"
                }, {
                    latlngs: [
                        { lat: 3, lng: 3, timestamp: new Date() },
                        { lat: 2, lng: 2, timestamp: new Date() }
                    ],
                    routePoint: { lat: 2, lng: 2 },
                    routingType: "Hike"
                }],
                state: "ReadOnly",
            }]);
            setupSelectedRoute(store, "1");

            const spy = jasmine.createSpy();
            store.dispatch = spy;

            selectedRouteService.mergeRoutes(false);

            expect(spy.calls.all()[0].args[0]).toBeInstanceOf(MergeRoutesAction);
            expect(spy.calls.all()[0].args[0].mergedRouteData.segments.length).toBe(3);
            expect(spy.calls.all()[0].args[0].mergedRouteData.segments[0].latlngs[0].lat).toBe(1);
            expect(spy.calls.all()[0].args[0].mergedRouteData.segments[2].latlngs[1].lat).toBe(3);
        }));

    it("Should merge routes with a gap and remove the gap", inject([SelectedRouteService, Store],
        (selectedRouteService: SelectedRouteService, store: Store) => {
            setupRoutes(store, [{
                id: "1",
                description: "",
                markers: [],
                name: "name",
                segments: [{
                    latlngs: [
                        { lat: 1, lng: 1, timestamp: new Date() },
                        { lat: 1, lng: 1, timestamp: new Date() }
                    ],
                    routePoint: { lat: 1, lng: 1 },
                    routingType: "Hike"
                }, {
                    latlngs: [
                        { lat: 1, lng: 1, timestamp: new Date() },
                        { lat: 2, lng: 2, timestamp: new Date() }
                    ],
                    routePoint: { lat: 2, lng: 2 },
                    routingType: "Hike"
                }],
                state: "ReadOnly",
            }, {
                id: "2",
                description: "",
                markers: [],
                name: "name",
                segments: [{
                    latlngs: [
                        { lat: 2.0001, lng: 2.0001, timestamp: new Date() },
                        { lat: 2.0001, lng: 2.0001, timestamp: new Date() }
                    ],
                    routePoint: { lat: 2.0001, lng: 2.0001 },
                    routingType: "Hike"
                }, {
                    latlngs: [
                        { lat: 2.0001, lng: 2.0001, timestamp: new Date() },
                        { lat: 3, lng: 3, timestamp: new Date() }
                    ],
                    routePoint: { lat: 3, lng: 3 },
                    routingType: "Hike"
                }],
                state: "ReadOnly",
            }]);
            setupSelectedRoute(store, "1");

            const spy = jasmine.createSpy();
            store.dispatch = spy;

            selectedRouteService.mergeRoutes(false);

            expect(spy.calls.all()[0].args[0]).toBeInstanceOf(MergeRoutesAction);
            expect(spy.calls.all()[0].args[0].mergedRouteData.segments.length).toBe(3);
            expect(spy.calls.all()[0].args[0].mergedRouteData.segments[0].latlngs[0].lat).toBe(1);
            expect(spy.calls.all()[0].args[0].mergedRouteData.segments[1].latlngs[1].lat).toBe(2);
            expect(spy.calls.all()[0].args[0].mergedRouteData.segments[2].latlngs[0].lat).toBe(2);
            expect(spy.calls.all()[0].args[0].mergedRouteData.segments[2].latlngs[1].lat).toBe(2.0001);
            expect(spy.calls.all()[0].args[0].mergedRouteData.segments[2].latlngs[2].lat).toBe(3);
        }));

    it("Should revese an empty route", inject([SelectedRouteService, Store],
        (selectedRouteService: SelectedRouteService, store: Store) => {
            setupRoutes(store, [{
                id: "1",
                description: "",
                markers: [],
                name: "name",
                segments: [],
                state: "ReadOnly",
            }]);
            setupSelectedRoute(store, "1");

            const spy = jasmine.createSpy();
            store.dispatch = spy;

            selectedRouteService.reverseRoute("1");

            expect(spy.calls.all()[0].args[0]).toBeInstanceOf(ReplaceRouteAction);
            const action = spy.calls.all()[0].args[0] as ReplaceRouteAction;
            expect(action.routeId).toBe("1");
            expect(action.routeData.segments.length).toBe(0);
        }));

    it("Should revese a route", inject([SelectedRouteService, Store],
        (selectedRouteService: SelectedRouteService, store: Store) => {
            setupRoutes(store, [{
                id: "1",
                description: "",
                markers: [],
                name: "name",
                segments: [{
                    latlngs: [
                        { lat: 1, lng: 1, timestamp: new Date() },
                        { lat: 1, lng: 1, timestamp: new Date() }
                    ],
                    routePoint: { lat: 1, lng: 1 },
                    routingType: "Hike"
                }, {
                    latlngs: [
                        { lat: 1, lng: 1, timestamp: new Date() },
                        { lat: 2, lng: 2, timestamp: new Date() }
                    ],
                    routePoint: { lat: 2, lng: 2 },
                    routingType: "Hike"
                }, {
                    latlngs: [
                        { lat: 2, lng: 2, timestamp: new Date() },
                        { lat: 3, lng: 3, timestamp: new Date() }
                    ],
                    routePoint: { lat: 3, lng: 3 },
                    routingType: "Hike"
                }],
                state: "ReadOnly",
            }]);
            setupSelectedRoute(store, "1");

            const spy = jasmine.createSpy();
            store.dispatch = spy;

            selectedRouteService.reverseRoute("1");

            expect(spy.calls.all()[0].args[0]).toBeInstanceOf(ReplaceRouteAction);
            const action = spy.calls.all()[0].args[0] as ReplaceRouteAction;
            expect(action.routeId).toBe("1");
            expect(action.routeData.segments.length).toBe(3);
            expect(action.routeData.segments[0].latlngs[0].lat).toBe(3);
            expect(action.routeData.segments[0].latlngs[1].lng).toBe(3);
            expect(action.routeData.segments[2].latlngs[0].lat).toBe(2);
            expect(action.routeData.segments[2].latlngs[1].lng).toBe(1);
        }));

    it("Should remove the first segement", inject([SelectedRouteService, Store],
        (selectedRouteService: SelectedRouteService, store: Store) => {
            setupRoutes(store, [{
                id: "1",
                description: "",
                markers: [],
                name: "name",
                segments: [{
                    latlngs: [
                        { lat: 1, lng: 1, timestamp: new Date() },
                        { lat: 1, lng: 1, timestamp: new Date() }
                    ],
                    routePoint: { lat: 1, lng: 1 },
                    routingType: "Hike"
                }, {
                    latlngs: [
                        { lat: 1, lng: 1, timestamp: new Date() },
                        { lat: 2, lng: 2, timestamp: new Date() }
                    ],
                    routePoint: { lat: 2, lng: 2 },
                    routingType: "Hike"
                }, {
                    latlngs: [
                        { lat: 2, lng: 2, timestamp: new Date() },
                        { lat: 3, lng: 3, timestamp: new Date() }
                    ],
                    routePoint: { lat: 3, lng: 3 },
                    routingType: "Hike"
                }],
                state: "ReadOnly",
            }]);
            setupSelectedRoute(store, "1");

            const spy = jasmine.createSpy();
            store.dispatch = spy;

            selectedRouteService.removeSegment(0);

            expect(spy.calls.all()[0].args[0]).toBeInstanceOf(UpdateSegmentsAction);
            const action = spy.calls.all()[0].args[0] as UpdateSegmentsAction;
            expect(action.routeId).toBe("1");
            expect(action.indices).toEqual([0, 1]);
            expect(action.segmentsData[0].latlngs[0].lat).toBe(2);
            expect(action.segmentsData[0].latlngs[1].lng).toBe(2);
        }));

    it("Should remove the last segement", inject([SelectedRouteService, Store],
        (selectedRouteService: SelectedRouteService, store: Store) => {
            setupRoutes(store, [{
                id: "1",
                description: "",
                markers: [],
                name: "name",
                segments: [{
                    latlngs: [
                        { lat: 1, lng: 1, timestamp: new Date() },
                        { lat: 1, lng: 1, timestamp: new Date() }
                    ],
                    routePoint: { lat: 1, lng: 1 },
                    routingType: "Hike"
                }, {
                    latlngs: [
                        { lat: 1, lng: 1, timestamp: new Date() },
                        { lat: 2, lng: 2, timestamp: new Date() }
                    ],
                    routePoint: { lat: 2, lng: 2 },
                    routingType: "Hike"
                }, {
                    latlngs: [
                        { lat: 2, lng: 2, timestamp: new Date() },
                        { lat: 3, lng: 3, timestamp: new Date() }
                    ],
                    routePoint: { lat: 3, lng: 3 },
                    routingType: "Hike"
                }],
                state: "ReadOnly",
            }]);
            setupSelectedRoute(store, "1");

            const spy = jasmine.createSpy();
            store.dispatch = spy;

            selectedRouteService.removeSegment(2);

            expect(spy.calls.all()[0].args[0]).toBeInstanceOf(DeleteSegmentAction);
            const action = spy.calls.all()[0].args[0] as DeleteSegmentAction;
            expect(action.routeId).toBe("1");
            expect(action.index).toBe(2);
        }));

    it("Should remove a middle segement", inject([SelectedRouteService, Store],
        async (selectedRouteService: SelectedRouteService, store: Store) => {
            setupRoutes(store, [{
                id: "1",
                description: "",
                markers: [],
                name: "name",
                segments: [{
                    latlngs: [
                        { lat: 1, lng: 1, timestamp: new Date() },
                        { lat: 1, lng: 1, timestamp: new Date() }
                    ],
                    routePoint: { lat: 1, lng: 1 },
                    routingType: "Hike"
                }, {
                    latlngs: [
                        { lat: 1, lng: 1, timestamp: new Date() },
                        { lat: 2, lng: 2, timestamp: new Date() }
                    ],
                    routePoint: { lat: 2, lng: 2 },
                    routingType: "Hike"
                }, {
                    latlngs: [
                        { lat: 2, lng: 2, timestamp: new Date() },
                        { lat: 3, lng: 3, timestamp: new Date() }
                    ],
                    routePoint: { lat: 3, lng: 3 },
                    routingType: "Hike"
                }],
                state: "ReadOnly",
            }]);
            setupSelectedRoute(store, "1");

            const spy = jasmine.createSpy();
            store.dispatch = spy;

            await selectedRouteService.removeSegment(1);

            expect(spy.calls.all()[0].args[0]).toBeInstanceOf(UpdateSegmentsAction);
            const action = spy.calls.all()[0].args[0] as UpdateSegmentsAction;
            expect(action.routeId).toBe("1");
            expect(action.indices).toEqual([1, 2]);
            expect(action.segmentsData[0].routePoint.lat).toBe(3);
        }));

    it("Should make all points editable for not exiting route", inject([SelectedRouteService, Store],
        (selectedRouteService: SelectedRouteService, store: Store) => {
            const spy = jasmine.createSpy();
            store.dispatch = spy;

            selectedRouteService.makeAllPointsEditable("1");

            expect(spy).not.toHaveBeenCalled();
        }));

    it("Should make all points editable", inject([SelectedRouteService, Store],
        (selectedRouteService: SelectedRouteService, store: Store) => {
            setupRoutes(store, [{
                id: "1",
                description: "",
                markers: [],
                name: "name",
                segments: [{
                    latlngs: [
                        { lat: 1, lng: 1, timestamp: new Date() },
                        { lat: 1, lng: 1, timestamp: new Date() }
                    ],
                    routePoint: { lat: 1, lng: 1 },
                    routingType: "Hike"
                }, {
                    latlngs: [
                        { lat: 1, lng: 1, timestamp: new Date() },
                        { lat: 2, lng: 2, timestamp: new Date() },
                        { lat: 3, lng: 3, timestamp: new Date() }
                    ],
                    routePoint: { lat: 3, lng: 3 },
                    routingType: "Hike"
                }],
                state: "ReadOnly",
            }]);
            setupSelectedRoute(store, "1");

            const spy = jasmine.createSpy();
            store.dispatch = spy;

            selectedRouteService.makeAllPointsEditable("1");

            expect(spy.calls.all()[0].args[0]).toBeInstanceOf(ReplaceSegmentsAction);
            const action = spy.calls.all()[0].args[0] as ReplaceSegmentsAction;
            expect(action.routeId).toBe("1");
            expect(action.segmentsData.length).toBe(3);
            expect(action.segmentsData[0].latlngs[0].lat).toBe(1);
            expect(action.segmentsData[1].latlngs[0].lat).toBe(1);
            expect(action.segmentsData[1].latlngs[1].lat).toBe(2);
            expect(action.segmentsData[2].latlngs[0].lat).toBe(2);
            expect(action.segmentsData[2].latlngs[1].lat).toBe(3);
        }));

    it("Add external empty route should not fail", inject([SelectedRouteService, Store],
        (selectedRouteService: SelectedRouteService, store: Store) => {
            const spy = jasmine.createSpy();
            store.dispatch = spy;

            selectedRouteService.addRoutes([]);

            expect(spy).not.toHaveBeenCalled();
        }));

    it("Add external route with only markers to first route", inject([SelectedRouteService, Store],
        (selectedRouteService: SelectedRouteService, store: Store) => {
            setupRoutes(store, [{
                id: "1",
                description: "",
                markers: [],
                name: "name",
                segments: [],
                state: "ReadOnly",
            }]);
            setupSelectedRoute(store, "1");

            const spy = jasmine.createSpy();
            store.dispatch = spy;

            selectedRouteService.addRoutes([{ segments: [], markers: [{ title: "title" }] } as RouteData]);

            expect(spy.calls.all()[0].args[0]).toBeInstanceOf(AddPrivatePoiAction);
            const action = spy.calls.all()[0].args[0] as AddPrivatePoiAction;
            expect(action.routeId).toBe("1");
            expect(action.markerData.title).toBe("title");
        }));

    it("Add external route to routes", inject([SelectedRouteService, Store],
        (selectedRouteService: SelectedRouteService, store: Store) => {
            setupRoutes(store, [{
                id: "1",
                description: "",
                markers: [],
                name: "name",
                segments: [],
                state: "ReadOnly",
            }]);
            setupSelectedRoute(store, "1");

            const spy = jasmine.createSpy();
            store.dispatch = spy;

            selectedRouteService.addRoutes([{ name: "name", segments: [{}], markers: [{ title: "title" }] } as RouteData]);

            expect(spy.calls.all()[0].args[0]).toBeInstanceOf(AddRouteAction);
            const action = spy.calls.all()[0].args[0] as AddRouteAction;
            expect(action.routeData.name).toBe("name 1");
        }));
});
