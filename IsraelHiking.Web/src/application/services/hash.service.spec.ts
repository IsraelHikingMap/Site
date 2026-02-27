import { NavigationEnd, provideRouter, Router, UrlTree } from "@angular/router";
import { NgxsModule, Store } from "@ngxs/store";
import { TestBed, inject } from "@angular/core/testing";
import { Subject } from "rxjs";

import { Urls } from "../urls";
import { MapService } from "./map.service";
import { HashService, RouteStrings } from "./hash.service";
import { SidebarService } from "./sidebar.service";
import { DataContainerService } from "./data-container.service";
import { ShareUrlsService } from "./share-urls.service";
import { LayersService } from "./layers.service";
import { InMemoryReducer } from "../reducers/in-memory.reducer";

describe("HashService", () => {
    beforeEach(() => {
        const routerMock = {
            navigate: jasmine.createSpy("navigate"),
            events: new Subject<any>(),
            createUrlTree: (array: []) => array.join("/"),
            parseUrl: (url: string) => ({ root: { children: { primary: { segments: url.split("/") }, } }, queryParams: {} }),
            url: ""
        };
        TestBed.configureTestingModule({
            imports: [NgxsModule.forRoot([InMemoryReducer])],
            providers: [
                provideRouter([]),
                { provide: Router, useValue: routerMock },
                { provide: MapService, useValue: {} },
                { provide: DataContainerService, useValue: {} },
                { provide: ShareUrlsService, useValue: {} },
                {
                    provide: LayersService, useValue: {
                        addLayerAfterNavigation: () => { }
                    }
                },
                SidebarService,
                HashService
            ]
        });
    });

    it("Should not reset address bar if sidebar is open", inject([HashService, Router, Store, SidebarService],
        (service: HashService, routerMock: Router, store: Store, sidebar: SidebarService) => {
            const spy = jasmine.createSpy();
            routerMock.navigate = spy;
            store.reset({
                poiState: {}
            });
            service.initialize();
            sidebar.show("public-poi");
            store.reset({
                poiState: {
                    selectedPointOfInterest: {}
                },
                inMemoryState: {},
                locationState: {
                    zoom: 1,
                    latitude: 2,
                    longitude: 3
                }
            });

            expect(spy).not.toHaveBeenCalled();
        }
    ));

    it("Should not reset address bar if shares are open", inject([HashService, Router, Store, MapService],
        (service: HashService, routerMock: Router, store: Store, mapService: MapService) => {
            const spy = jasmine.createSpy();
            routerMock.navigate = spy;
            (routerMock as any).url = RouteStrings.ROUTE_SHARES;
            mapService.isMoving = () => false;
            store.reset({
                poiState: {}
            });
            service.initialize();
            store.reset({
                poiState: {
                    selectedPointOfInterest: {}
                },
                inMemoryState: {},
                locationState: {
                    zoom: 1,
                    latitude: 2,
                    longitude: 3
                }
            });

            expect(spy).not.toHaveBeenCalled();
        }
    ));

    it("Should not reset address bar if offline management are open", inject([HashService, Router, Store, MapService],
        (service: HashService, routerMock: Router, store: Store, mapService: MapService) => {
            const spy = jasmine.createSpy();
            routerMock.navigate = spy;
            (routerMock as any).url = RouteStrings.ROUTE_OFFLINE_MANAGEMENT;
            mapService.isMoving = () => false;
            store.reset({
                poiState: {}
            });
            service.initialize();
            store.reset({
                poiState: {
                    selectedPointOfInterest: {}
                },
                inMemoryState: {},
                locationState: {
                    zoom: 1,
                    latitude: 2,
                    longitude: 3
                }
            });

            expect(spy).not.toHaveBeenCalled();
        }
    ));

    it("Should navigate to share url if it stored in the state", inject([HashService, Router, Store],
        (service: HashService, routerMock: Router, store: Store) => {
            const spy = jasmine.createSpy();
            routerMock.navigate = spy;
            service.initialize();
            store.reset({
                poiState: {},
                inMemoryState: {
                    shareUrl: {}
                },
                locationState: {
                    zoom: 1,
                    latitude: 2,
                    longitude: 3
                }
            });

            expect(spy).toHaveBeenCalled();
            expect(spy.calls.all()[0].args[0][0]).toBe(RouteStrings.ROUTE_SHARE);
        }
    ));

    it("Should navigate to file url if it stored in the state", inject([HashService, Router, Store],
        (service: HashService, routerMock: Router, store: Store) => {
            const spy = jasmine.createSpy();
            routerMock.navigate = spy;
            service.initialize();
            store.reset({
                poiState: {},
                inMemoryState: {
                    fileUrl: {},
                    baseLayer: "baseLayer"
                },
                locationState: {
                    zoom: 1,
                    latitude: 2,
                    longitude: 3
                }
            });
            expect(spy).toHaveBeenCalled();
            expect(spy.calls.all()[0].args[0][0]).toBe(RouteStrings.ROUTE_URL);
        }
    ));

    it("Should not navigate to location if the map is moving", inject([HashService, Router, Store, MapService],
        (service: HashService, routerMock: Router, store: Store, mapService: MapService) => {
            const spy = jasmine.createSpy();
            routerMock.navigate = spy;
            service.initialize();
            mapService.isMoving = () => true;
            store.reset({
                poiState: {},
                inMemoryState: {},
                locationState: {
                    zoom: 1,
                    latitude: 2,
                    longitude: 3
                },
            });

            expect(spy).not.toHaveBeenCalled();
        }
    ));

    it("Should navigate to location if the map is not moving", inject([HashService, Router, Store, MapService],
        (service: HashService, routerMock: Router, store: Store, mapService: MapService) => {
            const spy = jasmine.createSpy();
            routerMock.navigate = spy;
            mapService.isMoving = () => false;
            service.initialize();
            store.reset({
                poiState: {},
                inMemoryState: {},
                locationState: {
                    zoom: 1,
                    latitude: 2,
                    longitude: 3
                }
            });

            expect(spy).toHaveBeenCalled();
            expect(spy.calls.all()[0].args[0][0]).toBe(RouteStrings.ROUTE_MAP);
        }
    ));

    it("Should return map address",
        inject([HashService, Router, Store], (service: HashService, routerMock: Router, store: Store) => {
            routerMock.createUrlTree = (arr: []) => arr.join("/") as any as UrlTree;
            store.reset({
                inMemoryState: {},
                locationState: {
                    zoom: 1,
                    latitude: 2,
                    longitude: 3
                }
            });

            const href = service.getHref();

            expect(href).toBe(Urls.baseAddress + "map/2.00/2.000000/3.000000");
        })
    );

    it("Should return share url",
        inject([HashService, Router, Store, ShareUrlsService], (service: HashService, routerMock: Router, store: Store, shareUrlService: ShareUrlsService) => {

            shareUrlService.getFullUrlFromShareId = () => "share-address";
            store.reset({
                inMemoryState: {
                    shareUrl: { id: "1" }
                }
            });

            const href = service.getHref();

            expect(href).toBe("share-address");
        }
        ));

    it("Should return external url",
        inject([HashService, Router, Store], (service: HashService, routerMock: Router, store: Store) => {
            routerMock.createUrlTree = (array: [], options: any) => "file-address?" + options.queryParams.baselayer as any as UrlTree;
            store.reset({
                inMemoryState: {
                    fileUrl: "fileUrl"
                },
                layersState: {
                    selectedBaseLayerKey: "base-layer"
                }
            });
            const href = service.getHref();

            expect(href).toBe(Urls.baseAddress + "file-address?base-layer");
        }
        ));

    it("Should flyTo in case of map url", inject([Router, MapService, HashService],
        (routerMock: Router, mapService: MapService) => {
            mapService.flyTo = jasmine.createSpy();
            (routerMock as any).url = RouteStrings.ROUTE_MAP + "/2.00/2.000000/3.000000";
            (routerMock.events as Subject<any>).next(new NavigationEnd(1, routerMock.url, routerMock.url));

            expect(mapService.flyTo).toHaveBeenCalled();

        }
    ));

    it("Should set share in case of share url", inject([Router, DataContainerService, HashService],
        (routerMock: Router, dataContainerService: DataContainerService) => {
            dataContainerService.setShareUrlAfterNavigation = jasmine.createSpy();
            (routerMock as any).url = RouteStrings.ROUTE_SHARE + "/1234";
            (routerMock.events as Subject<any>).next(new NavigationEnd(1, routerMock.url, routerMock.url));

            expect(dataContainerService.setShareUrlAfterNavigation).toHaveBeenCalled();

        }
    ));

    it("Should set file in case of file url", inject([Router, DataContainerService, HashService],
        (routerMock: Router, dataContainerService: DataContainerService) => {
            dataContainerService.setFileUrlAfterNavigation = jasmine.createSpy();
            (routerMock as any).url = RouteStrings.ROUTE_URL + "/1234";
            (routerMock.events as Subject<any>).next(new NavigationEnd(1, routerMock.url, routerMock.url));

            expect(dataContainerService.setFileUrlAfterNavigation).toHaveBeenCalled();
        }
    ));

    it("Should open poi pane in case of poi url", inject([Router, SidebarService, HashService],
        (routerMock: Router, sidebarService: SidebarService) => {
            sidebarService.show = jasmine.createSpy();
            (routerMock as any).url = RouteStrings.ROUTE_POI + "/1234";
            (routerMock.events as Subject<any>).next(new NavigationEnd(1, routerMock.url, routerMock.url));

            expect(sidebarService.show).toHaveBeenCalled();
        }
    ));

    it("Should show layers pane in case of layers url", inject([Router, SidebarService, MapService, HashService],
        (routerMock: Router, sidebarService: SidebarService, mapService: MapService) => {
            sidebarService.show = jasmine.createSpy();
            mapService.isMoving = () => true;
            (routerMock as any).url = RouteStrings.ROUTE_LAYER + "/1234";
            (routerMock.events as Subject<any>).next(new NavigationEnd(1, routerMock.url, routerMock.url));

            expect(sidebarService.show).toHaveBeenCalled();
        }
    ));

    it("Should hide sidebar in case of root url", inject([HashService, Router, SidebarService],
        (service: HashService, routerMock: Router, sidebarService: SidebarService) => {
            sidebarService.hide = jasmine.createSpy();
            (routerMock as any).url = RouteStrings.ROUTE_ROOT;
            (routerMock.events as Subject<any>).next(new NavigationEnd(1, routerMock.url, routerMock.url));

            expect(sidebarService.hide).toHaveBeenCalled();
        }
    ));

    it("Should return full URL from LatLng", inject([HashService],
        (service: HashService) => {
            const latlng = { lat: 1, lng: 2, alt: 0 };
            const fullUrl = service.getFullUrlFromLatLng(latlng);

            expect(fullUrl).toContain(RouteStrings.POI);
            expect(fullUrl).toContain(RouteStrings.COORDINATES);
        }
    ));

    it("should return is home true when on home", inject([HashService, Router], (service: HashService, routerMock: Router) => {
        (routerMock as any).url = RouteStrings.ROUTE_ROOT;

        expect(service.isHome()).toBe(true);
    }));

    it("should return is home true when on landing", inject([HashService, Router], (service: HashService, routerMock: Router) => {
        (routerMock as any).url = RouteStrings.ROUTE_LANDING;

        expect(service.isHome()).toBe(true);
    }));

    it("should return is shares true when on shares", inject([HashService, Router], (service: HashService, routerMock: Router) => {
        (routerMock as any).url = RouteStrings.ROUTE_SHARES;

        expect(service.isShares()).toBe(true);
    }));
});
