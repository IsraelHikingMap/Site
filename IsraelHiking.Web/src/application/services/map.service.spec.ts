import { TestBed, inject } from "@angular/core/testing";
import { NgxsModule } from "@ngxs/store";
import { Map } from "maplibre-gl";
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

    it("Should get full URL", inject([MapService], (service: MapService) => {
        const url = service.getFullUrl("123");

        expect(url).toContain("/123");
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

    it("Should move to", inject([MapService],
        async (service: MapService) => {
            const spy = jasmine.createSpy();
            service.setMap({ easeTo: spy, on: () => { } } as any as Map);
            await service.moveTo({ lng: 2, lat: 2 }, 1, 1);
            expect(spy).toHaveBeenCalled();
        }));
});