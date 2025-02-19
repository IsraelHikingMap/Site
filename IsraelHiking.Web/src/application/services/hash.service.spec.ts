import { NavigationEnd, provideRouter, Router, UrlTree } from "@angular/router";
import { NgxsModule, Store } from "@ngxs/store";
import { TestBed, inject } from "@angular/core/testing";
import { Subject } from "rxjs";

import { Urls } from "../urls";
import { MapService } from "./map.service";
import { HashService, RouteStrings } from "./hash.service";
import { SidebarService } from "./sidebar.service";
import { DataContainerService } from "./data-container.service";
import { FitBoundsService } from "./fit-bounds.service";
import { ShareUrlsService } from "./share-urls.service";
import { InMemoryReducer } from "../reducers/in-memory.reducer";

describe("HashService", () => {
    beforeEach(() => {
        const routerMock = {
            navigate: jasmine.createSpy("navigate"),
            events: new Subject<any>(),
            createUrlTree: () => { },
            parseUrl: (url: string) => ({ root: { children: { primary: {segments: url.split("/")}, }}, queryParams: {} })
        };
        TestBed.configureTestingModule({
            imports: [NgxsModule.forRoot([InMemoryReducer])],
            providers: [
                provideRouter([]),
                { provide: Router, useValue: routerMock },
                { provide: MapService, useValue: {} },
                { provide: DataContainerService, useValue: {} },
                { provide: FitBoundsService, useValue: {} },
                { provide: ShareUrlsService, useValue: {} },
                SidebarService,
                HashService
            ]
        });
    });

    it("Should not reset address bar if sidebar is open", inject([HashService, Router, Store], 
        (service: HashService, routerMock: Router, store: Store) => {
            const spy = jasmine.createSpy();
            routerMock.navigate = spy;
            store.reset({
                poiState: {
                    selectedPointOfInterest: {}
                }
            });

            expect(spy).not.toHaveBeenCalled();
    }));

    it("Should navigate to share url if it stored in the state", inject([HashService, Router, Store], 
        (service: HashService, routerMock: Router, store: Store) => {
            const spy = jasmine.createSpy();
            routerMock.navigate = spy;
            service.initialize();
            store.reset({
                poiState: {},
                inMemoryState: {
                    shareUrl: {}
                }
            });

            expect(spy).toHaveBeenCalled();
            expect(spy.calls.all()[0].args[0][0]).toBe(RouteStrings.ROUTE_SHARE);
    }));

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
                }
            });
            expect(spy).toHaveBeenCalled();
            expect(spy.calls.all()[0].args[0][0]).toBe(RouteStrings.ROUTE_URL);
    }));

    it("Should not navigate to location if the map is moving", inject([HashService, Router, Store, MapService], 
        (service: HashService, routerMock: Router, store: Store, mapService: MapService) => {
            const spy = jasmine.createSpy();
            routerMock.navigate = spy;
            mapService.map = { isMoving: () => true } as any;
            store.reset({
                locationState: {
                    zoom: 1,
                    latitude: 2,
                    longitude: 3
                },
            });

            expect(spy).not.toHaveBeenCalled();
    }));

    it("Should navigate to location if the map is not moving", inject([HashService, Router, Store, MapService], 
        (service: HashService, routerMock: Router, store: Store, mapService: MapService) => {
            const spy = jasmine.createSpy();
            routerMock.navigate = spy;
            mapService.map = { isMoving: () => false } as any;
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
    }));

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
        }));

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
        }));

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
        }));

        it("Should flyTo in case of map url", inject([HashService, Router, FitBoundsService], 
            (service: HashService, routerMock: Router, fitBoundService: FitBoundsService) => {
                fitBoundService.flyTo = jasmine.createSpy();
                (routerMock as any).url = RouteStrings.ROUTE_MAP + "/2.00/2.000000/3.000000";
                (routerMock.events as Subject<any>).next(new NavigationEnd(1, routerMock.url, routerMock.url));

                expect(fitBoundService.flyTo).toHaveBeenCalled();

        }));

        it("Should set share in case of share url", inject([HashService, Router, DataContainerService], 
            (service: HashService, routerMock: Router, dataContainerService: DataContainerService) => {
                dataContainerService.setShareUrlAfterNavigation = jasmine.createSpy();
                (routerMock as any).url = RouteStrings.ROUTE_SHARE + "/1234";
                (routerMock.events as Subject<any>).next(new NavigationEnd(1, routerMock.url, routerMock.url));

                expect(dataContainerService.setShareUrlAfterNavigation).toHaveBeenCalled();

        }));

        it("Should set file in case of file url", inject([HashService, Router, DataContainerService], 
            (service: HashService, routerMock: Router, dataContainerService: DataContainerService) => {
                dataContainerService.setFileUrlAfterNavigation = jasmine.createSpy();
                (routerMock as any).url = RouteStrings.ROUTE_URL + "/1234";
                (routerMock.events as Subject<any>).next(new NavigationEnd(1, routerMock.url, routerMock.url));

                expect(dataContainerService.setFileUrlAfterNavigation).toHaveBeenCalled();
        }));

        it("Should open poi pane in case of poi url", inject([HashService, Router, SidebarService], 
            (service: HashService, routerMock: Router, sidebarService: SidebarService) => {
                sidebarService.show = jasmine.createSpy();
                (routerMock as any).url = RouteStrings.ROUTE_POI + "/1234";
                (routerMock.events as Subject<any>).next(new NavigationEnd(1, routerMock.url, routerMock.url));

                expect(sidebarService.show).toHaveBeenCalled();
        }));

        it("Should hide sidebar in case of root url", inject([HashService, Router, SidebarService], 
            (service: HashService, routerMock: Router, sidebarService: SidebarService) => {
                sidebarService.hide = jasmine.createSpy();
                (routerMock as any).url = RouteStrings.ROUTE_ROOT;
                (routerMock.events as Subject<any>).next(new NavigationEnd(1, routerMock.url, routerMock.url));

                expect(sidebarService.hide).toHaveBeenCalled();
        }));
});
