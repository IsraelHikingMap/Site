import { TestBed, inject } from "@angular/core/testing";
import { vi, expect, it, describe, beforeEach } from "vitest";
import { NgxsModule } from "@ngxs/store";
import { MapService } from "./map.service";
import { CancelableTimeoutService } from "./cancelable-timeout.service";
import { InMemoryReducer } from "../reducers/in-memory.reducer";
import type { Map } from "maplibre-gl";

describe("MapService", () => {
    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [
                NgxsModule.forRoot([InMemoryReducer])
            ],
            providers: [
                MapService,
                CancelableTimeoutService,
            ]
        });
    });

    it("Should resolve promise when setting the map", inject([MapService], async (service: MapService) => {
        service.setMap({ on: () => {} } as any as Map);
        await service.initializationPromise;
        expect(true).toBeTruthy();
    }));

    it("Should set panned state on drag start", inject([MapService, CancelableTimeoutService], 
        async (service: MapService, cancelableTimeoutService: CancelableTimeoutService) => {
            const spy = vi.fn();
            cancelableTimeoutService.setTimeoutByName = spy;
            service.setMap({ on: (event: string, callback: () => void) => {
                if (event == "dragstart") callback();
            } } as any as Map);
            await service.initializationPromise;
            expect(spy).toHaveBeenCalled();
    }));

    it("Should should not do anything when missing image addres does not start with http", inject([MapService], 
        async (service: MapService) => {
            const spy = vi.fn();
            const mapMock = {
                loadImage: spy,
                on: (event: string, callback: (e: any) => void) => {
                    if (event == "styleimagemissing") callback({ id: "123"});
                } 
            } as any as Map
            service.setMap(mapMock);
            await service.initializationPromise;
            expect(spy).not.toHaveBeenCalled();
    }));

    it("Should load image when missing", inject([MapService], 
        async (service: MapService) => {
            const spy = vi.fn().mockReturnValue(Promise.resolve({ data: "123" }));
            const addImageSpy = vi.fn();
            const mapMock = {
                loadImage: spy,
                addImage: addImageSpy,
                on: (event: string, callback: (e: any) => void) => {
                    if (event == "styleimagemissing") {
                        callback({ id: "http://123.png"});
                    }
                } 
            } as any as Map
            service.setMap(mapMock);
            await service.initializationPromise;
            expect(spy).toHaveBeenCalledTimes(1);
            expect(addImageSpy).toHaveBeenCalled();
    }));
    
    it("Should not call twice on the same missing", inject([MapService], 
        async (service: MapService) => {
            const spy = vi.fn().mockReturnValue(Promise.resolve({ data: "123" }));
            const addImageSpy = vi.fn();
            let storedCallback = (_e: any) => {};
            const mapMock = {
                loadImage: spy,
                addImage: addImageSpy,
                on: (event: string, callback: (e: any) => void) => {
                    if (event == "styleimagemissing") {
                        storedCallback = callback;
                        callback({ id: "http://123.png"});
                    }
                } 
            } as any as Map
            service.setMap(mapMock);
            await service.initializationPromise;
            storedCallback({ id: "http://123.png"});
            expect(spy).toHaveBeenCalledTimes(1);
            expect(addImageSpy).toHaveBeenCalledTimes(1);
    }));
});