import { TestBed, inject } from "@angular/core/testing";
import { NgxsModule } from "@ngxs/store";
import type { Map, ErrorEvent } from "maplibre-gl";

import { MapService } from "./map.service";
import { CancelableTimeoutService } from "./cancelable-timeout.service";
import { InMemoryReducer } from "../reducers/in-memory.reducer";
import { LoggingService } from "./logging.service";
import { SidebarService } from "./sidebar.service";

describe("MapService", () => {
    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [
                NgxsModule.forRoot([InMemoryReducer])
            ],
            providers: [
                MapService,
                CancelableTimeoutService,
                { provide: SidebarService, useValue: {} },
                { provide: LoggingService, useValue: {} }
            ]
        });
    });

    it("Should resolve promise when setting the map", inject([MapService], async (service: MapService) => {
        service.setMap({ on: () => { } } as any as Map);
        await service.initializationPromise;
        expect(true).toBeTrue();
    }));

    it("Should unset the map and remove listeners", inject([MapService], async (service: MapService) => {
        const spy = jasmine.createSpy();
        service.setMap({ on: () => { }, off: spy } as any as Map);
        await service.initializationPromise;
        service.unsetMap();
        expect(spy).toHaveBeenCalled();
    }));

    it("Should get full URL", inject([MapService], (service: MapService) => {
        const url = service.getFullUrl("123");

        expect(url).toContain("/123");
    }));

    it("Should set panned state on drag start", inject([MapService, CancelableTimeoutService],
        async (service: MapService, cancelableTimeoutService: CancelableTimeoutService) => {
            const spy = jasmine.createSpy();
            cancelableTimeoutService.setTimeoutByName = spy;
            service.initialize();
            service.setMap({
                on: (event: string, callback: () => void) => {
                    if (event == "dragstart") callback();
                }
            } as any as Map);
            await new Promise(resolve => setTimeout(resolve, 100));
            expect(spy).toHaveBeenCalled();
        }
    ));

    it("Should should not do anything when missing image addres does not start with http", inject([MapService],
        async (service: MapService) => {
            const spy = jasmine.createSpy();
            const mapMock = {
                loadImage: spy,
                on: (event: string, callback: (e: any) => void) => {
                    if (event == "styleimagemissing") callback({ id: "123" });
                }
            } as any as Map
            service.setMap(mapMock);
            await service.initializationPromise;
            expect(spy).not.toHaveBeenCalled();
        }
    ));

    it("Should load image when missing", inject([MapService],
        async (service: MapService) => {
            const spy = jasmine.createSpy().and.returnValue(Promise.resolve({ data: "123" }));
            const addImageSpy = jasmine.createSpy();
            const mapMock = {
                loadImage: spy,
                addImage: addImageSpy,
                on: (event: string, callback: (e: any) => void) => {
                    if (event == "styleimagemissing") {
                        callback({ id: "http://123.png" });
                    }
                }
            } as any as Map
            service.setMap(mapMock);
            await service.initializationPromise;
            expect(spy).toHaveBeenCalledTimes(1);
            expect(addImageSpy).toHaveBeenCalled();
        }
    ));

    it("Should not call twice on the same missing", inject([MapService],
        async (service: MapService) => {
            const spy = jasmine.createSpy().and.returnValue(Promise.resolve({ data: "123" }));
            const addImageSpy = jasmine.createSpy();
            let storedCallback = (_e: any) => { };
            const mapMock = {
                loadImage: spy,
                addImage: addImageSpy,
                on: (event: string, callback: (e: any) => void) => {
                    if (event == "styleimagemissing") {
                        storedCallback = callback;
                        callback({ id: "http://123.png" });
                    }
                }
            } as any as Map
            service.setMap(mapMock);
            await service.initializationPromise;
            storedCallback({ id: "http://123.png" });
            expect(spy).toHaveBeenCalledTimes(1);
            expect(addImageSpy).toHaveBeenCalledTimes(1);
        }
    ));

    it("should not log 418 error message", inject([MapService, LoggingService], async (service: MapService, loggingService: LoggingService) => {
        loggingService.error = jasmine.createSpy();
        service.setMap({
            on: (event: string, callback: (error: ErrorEvent) => void) => {
                if (event == "error") callback({ error: new Error("418") } as any as ErrorEvent);
            }
        } as any as Map);
        await service.initializationPromise;
        expect(loggingService.error).not.toHaveBeenCalled();
    }));

    it("should log error message", inject([MapService, LoggingService], async (service: MapService, loggingService: LoggingService) => {
        loggingService.error = jasmine.createSpy();
        service.setMap({
            on: (event: string, callback: (error: ErrorEvent) => void) => {
                if (event == "error") callback({ error: new Error("other") } as any as ErrorEvent);
            }
        } as any as Map);
        await service.initializationPromise;
        expect(loggingService.error).toHaveBeenCalled();
    }));

    it("should get bounds from map", inject([MapService], async (service: MapService) => {
        service.setMap({
            on: () => { },
            getBounds: () => ({ getNorthEast: () => ({ lat: 1, lng: 1 }), getSouthWest: () => ({ lat: 2, lng: 2 }) })
        } as any as Map);
        const bounds = service.getMapBounds();
        expect(bounds).toEqual({ northEast: { lat: 1, lng: 1 }, southWest: { lat: 2, lng: 2 } });
    }));

    it("should project point", inject([MapService], async (service: MapService) => {
        service.setMap({
            on: () => { },
            project: () => ({ x: 1, y: 2 })
        } as any as Map);
        const point = service.project({ lng: 1, lat: 2 });
        expect(point.x).toEqual(1);
        expect(point.y).toEqual(2);
    }));

    it("should get an empty list of features when the map was not initialized", inject([MapService], async (service: MapService) => {
        const features = service.getFeaturesFromTiles(["42"], "42");
        expect(features).toEqual([]);
    }));

    it("should get a list of features when the map was initialized", inject([MapService], async (service: MapService) => {
        service.setMap({
            on: () => { },
            querySourceFeatures: () => [{ id: "42" }, { id: "43" }]
        } as any as Map);
        const features = service.getFeaturesFromTiles(["layer1", "layer2"], "42");
        expect(features.length).toEqual(4);
    }));

    it("should return is moving when the map is moving", inject([MapService], async (service: MapService) => {
        service.setMap({
            on: () => { },
            isMoving: () => true
        } as any as Map);
        expect(service.isMoving()).toEqual(true);
    }));

    it("Should fit bounds when sidebar serive is open with padding on large screen", inject([MapService, SidebarService],
        async (service: MapService, sidebarService: SidebarService) => {
            sidebarService.isSidebarOpen = () => true;
            const spy = jasmine.createSpy();
            service.setMap({ fitBounds: spy, on: () => { }, getZoom: () => 1 } as any as Map);
            (window as any).innerWidth = 1500;
            await service.fitBounds({ northEast: { lat: 1, lng: 1 }, southWest: { lat: 2, lng: 2 } });
            expect(spy.calls.all()[0].args[1].padding.left).toBe(400);
        }));

    it("Should fit bounds when sidebar serive is open with padding on small screen", inject([MapService, SidebarService],
        async (service: MapService, sidebarService: SidebarService) => {
            sidebarService.isSidebarOpen = () => true;
            const spy = jasmine.createSpy();
            service.setMap({ fitBounds: spy, on: () => { }, getZoom: () => 1 } as any as Map);
            (window as any).innerWidth = 500;
            await service.fitBounds({ northEast: { lat: 1, lng: 1 }, southWest: { lat: 2, lng: 2 } });
            expect(spy.calls.all()[0].args[1].padding.bottom).toBe(window.innerHeight / 2);
        }));

    it("Should fit bounds when sidebar serive is closed without padding", inject([MapService, SidebarService],
        async (service: MapService, sidebarService: SidebarService) => {
            sidebarService.isSidebarOpen = () => false;
            const spy = jasmine.createSpy();
            service.setMap({ fitBounds: spy, on: () => { }, getZoom: () => 1 } as any as Map);
            await service.fitBounds({ northEast: { lat: 1, lng: 1 }, southWest: { lat: 2, lng: 2 } }, true);
            expect(spy.calls.all()[0].args[1].padding).toBe(0);
        }));

    it("Should not fly to on small changes", inject([MapService],
        async (service: MapService) => {
            service.setMap({ getCenter: () => { return { lat: 1, lng: 1 } }, flyTo: () => { }, on: () => { }, getZoom: () => 1 } as any as Map);
            const spy = jasmine.createSpy();
            await service.flyTo({ lng: 1, lat: 1 }, 1);
            expect(spy).not.toHaveBeenCalled();
        }));

    it("Should fly to on large changes", inject([MapService],
        async (service: MapService) => {
            const spy = jasmine.createSpy();
            service.setMap({ getCenter: () => { return { lat: 1, lng: 1 } }, flyTo: spy, on: () => { } } as any as Map);
            await service.flyTo({ lng: 2, lat: 2 }, 1);
            expect(spy).toHaveBeenCalled();
        }));

    it("Should move to with current zoom", inject([MapService],
        async (service: MapService) => {
            const spy = jasmine.createSpy();
            service.setMap({ easeTo: spy, on: () => { }, getZoom: () => 1 } as any as Map);
            await service.moveToWithCurrentZoom({ lng: 2, lat: 2 }, 1);
            expect(spy).toHaveBeenCalled();
            expect(spy.calls.all()[0].args[0].zoom).toBe(1);
        }));
});