import { describe, beforeEach, vi, it, expect } from "vitest";
import { TestBed, inject } from "@angular/core/testing";
import { provideStore, Store } from "@ngxs/store";
import type { ErrorEvent, LayerSpecification, Map, SourceSpecification } from "maplibre-gl";

import { MapService } from "./map.service";
import { CancelableTimeoutService } from "./cancelable-timeout.service";
import { LoggingService } from "./logging.service";
import { ResourcesService } from "./resources.service";
import { DatabaseService } from "./database.service";
import { OverpassTurboService } from "./overpass-turbo.service";
import { InMemoryReducer } from "../reducers/in-memory.reducer";
import { SetLocationAction } from "../reducers/location.reducer";

describe("MapService", () => {
    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                provideStore([InMemoryReducer]),
                MapService,
                CancelableTimeoutService,
                { provide: ResourcesService, useValue: {} },
                { provide: DatabaseService, useValue: {} },
                { provide: OverpassTurboService, useValue: {} },
                {
                    provide: LoggingService,
                    useValue: {
                        info: () => { },
                        error: () => { }
                    }
                }
            ]
        });
    });

    it("Should resolve promise when setting the map", inject([MapService], async (service: MapService) => {
        service.setMap({ on: () => { }, setMissingStyleImageResolver: () => { } } as unknown as Map);
        await service.initializationPromise;
        expect(true).toBeTruthy();
    }));

    it("Should unset the map and remove listeners", inject([MapService], async (service: MapService) => {
        const spy = vi.fn();
        service.setMap({ on: () => { }, off: spy, setMissingStyleImageResolver: () => { } } as unknown as Map);
        await service.initializationPromise;
        service.unsetMap();
        expect(spy).toHaveBeenCalled();
    }));

    it("Should get full URL", inject([MapService], (service: MapService) => {
        const url = service.getFullUrl("123");

        expect(url).toContain("/123");
    }));

    it("Should not do anything when missing image address does not start with http", inject([MapService],
        async (service: MapService) => {
            const spy = vi.fn();
            const mapMock = {
                loadImage: spy,
                on: () => { },
                setMissingStyleImageResolver: (resolver: (id: string) => void) => resolver("123")
            } as unknown as Map;
            service.setMap(mapMock);
            await service.initializationPromise;
            expect(spy).not.toHaveBeenCalled();
        }
    ));

    it("Should load image when missing", inject([MapService],
        async (service: MapService) => {
            const spy = vi.fn().mockReturnValue(Promise.resolve({ data: "123" }));
            const addImageSpy = vi.fn();
            const mapMock = {
                loadImage: spy,
                addImage: addImageSpy,
                on: () => { },
                setMissingStyleImageResolver: (resolver: (id: string) => Promise<void>) => resolver("http://123.png")
            } as unknown as Map;
            service.setMap(mapMock);
            await service.initializationPromise;
            expect(spy).toHaveBeenCalledTimes(1);
            expect(addImageSpy).toHaveBeenCalled();
        }
    ));

    it("Should not call twice on the same missing", inject([MapService],
        async (service: MapService) => {
            const spy = vi.fn().mockReturnValue(Promise.resolve({ data: "123" }));
            const addImageSpy = vi.fn();
            let storedResolver = (_id: string): void | Promise<void> => { };
            const mapMock = {
                loadImage: spy,
                addImage: addImageSpy,
                on: () => { },
                setMissingStyleImageResolver: (resolver: (id: string) => Promise<void>) => {
                    storedResolver = resolver;
                    return resolver("http://123.png");
                }
            } as unknown as Map;
            service.setMap(mapMock);
            await service.initializationPromise;
            await storedResolver("http://123.png");
            expect(spy).toHaveBeenCalledTimes(1);
            expect(addImageSpy).toHaveBeenCalledTimes(1);
        }
    ));

    it("should not log 418 error message", inject([MapService, LoggingService], async (service: MapService, loggingService: LoggingService) => {
        loggingService.error = vi.fn();
        service.setMap({
            setMissingStyleImageResolver: () => { },
            on: (event: string, callback: (error: ErrorEvent) => void) => {
                if (event == "error")
                    callback({ error: new Error("418") } as unknown as ErrorEvent);
            }
        } as unknown as Map);
        await service.initializationPromise;
        expect(loggingService.error).not.toHaveBeenCalled();
    }));

    it("should log error message", inject([MapService, LoggingService], async (service: MapService, loggingService: LoggingService) => {
        loggingService.error = vi.fn();
        service.setMap({
            setMissingStyleImageResolver: () => { },
            on: (event: string, callback: (error: ErrorEvent) => void) => {
                if (event == "error")
                    callback({ error: new Error("other") } as unknown as ErrorEvent);
            }
        } as unknown as Map);
        await service.initializationPromise;
        expect(loggingService.error).toHaveBeenCalled();
    }));

    it("should update the state on moveend", inject([MapService, Store], async (service: MapService, store: Store) => {
        const spy = vi.fn();
        store.dispatch = spy;
        store.reset({
            locationState: {
                longitude: 0,
                latitude: 0,
                zoom: 0
            }
        });
        service.setMap({
            setMissingStyleImageResolver: () => { },
            on: (event: string, callback: (e: unknown) => void) => {
                if (event == "moveend") callback({});
            },
            getCenter: () => ({ lng: 1, lat: 2 }),
            getZoom: () => 1
        } as unknown as Map);
        await service.initializationPromise;
        expect(spy).toHaveBeenCalled();
        expect(vi.mocked(spy).mock.calls[0][0]).toBeInstanceOf(SetLocationAction);
    }));

    it("should not update the state on moveend if location is the same", inject([MapService, Store], async (service: MapService, store: Store) => {
        const spy = vi.fn();
        store.dispatch = spy;
        store.reset({
            locationState: {
                longitude: 1,
                latitude: 2,
                zoom: 1
            }
        });
        service.setMap({
            setMissingStyleImageResolver: () => { },
            on: (event: string, callback: (e: unknown) => void) => {
                if (event == "moveend") callback({});
            },
            getCenter: () => ({ lng: 1, lat: 2 }),
            getZoom: () => 1
        } as unknown as Map);
        await service.initializationPromise;
        expect(spy).not.toHaveBeenCalled();
    }));

    it("should not throw if moveend is called after map removal", inject([MapService], async (service: MapService) => {
        let moveendCallback: (e: unknown) => void;
        service.setMap({
            setMissingStyleImageResolver: () => { },
            on: (event: string, callback: (e: unknown) => void) => {
                if (event == "moveend") moveendCallback = callback;
            },
            off: () => { }
        } as unknown as Map);
        await service.initializationPromise;
        service.unsetMap();
        expect(() => moveendCallback(null)).not.toThrow();
    }));

    it("should get bounds from map", inject([MapService], async (service: MapService) => {
        service.setMap({
            setMissingStyleImageResolver: () => { },
            on: () => { },
            getBounds: () => ({
                getNorthEast: () => ({ lat: 1, lng: 1 }),
                getSouthWest: () => ({ lat: 2, lng: 2 })
            })
        } as unknown as Map);
        const bounds = service.getMapBounds();
        expect(bounds).toEqual({ northEast: { lat: 1, lng: 1 }, southWest: { lat: 2, lng: 2 } });
    }));

    it("should project point", inject([MapService], async (service: MapService) => {
        service.setMap({
            setMissingStyleImageResolver: () => { },
            on: () => { },
            project: () => ({ x: 1, y: 2 })
        } as unknown as Map);
        const point = service.project({ lng: 1, lat: 2 });
        expect(point.x).toEqual(1);
        expect(point.y).toEqual(2);
    }));

    it("should get an empty list of features when the map was not initialized", inject([MapService], async (service: MapService) => {
        const features = service.getFeaturesFromTiles();
        expect(features).toEqual([]);
    }));

    it("should get a list of features when the map was initialized", inject([MapService], async (service: MapService) => {
        service.setMap({
            setMissingStyleImageResolver: () => { },
            on: () => { },
            queryRenderedFeatures: () => [{ id: "42" }, { id: "43" }],
            getLayer: () => true
        } as unknown as Map);
        const features = service.getFeaturesFromTiles();
        expect(features.length).toEqual(2);
    }));

    it("should return is moving when the map is moving", inject([MapService], async (service: MapService) => {
        service.setMap({
            setMissingStyleImageResolver: () => { },
            on: () => { },
            isMoving: () => true
        } as unknown as Map);
        expect(service.isMoving()).toEqual(true);
    }));

    it("Should fit bounds with default value when not passed", inject([MapService],
        async (service: MapService) => {
            const spy = vi.fn();
            service.setMap({
                fitBounds: spy,
                setMissingStyleImageResolver: () => { },
                on: () => { },
                getZoom: () => 1
            } as unknown as Map);
            await service.fitBounds({ northEast: { lat: 1, lng: 1 }, southWest: { lat: 2, lng: 2 } });
            expect(vi.mocked(spy).mock.calls[0][1].padding).toBe(50);
        }
    ));

    it("Should fit bounds when with padding on small screen", inject([MapService],
        async (service: MapService) => {
            const spy = vi.fn();
            service.setMap({
                fitBounds: spy,
                setMissingStyleImageResolver: () => { },
                on: () => { },
                getZoom: () => 1
            } as unknown as Map);
            const originalInnerWidth = (window as { innerWidth: number }).innerWidth;
            (window as { innerWidth: number }).innerWidth = 500;
            await service.fitBounds({ northEast: { lat: 1, lng: 1 }, southWest: { lat: 2, lng: 2 } }, 0, { bottom: window.innerHeight / 2 });
            (window as { innerWidth: number }).innerWidth = originalInnerWidth;
            expect(vi.mocked(spy).mock.calls[0][1].padding.bottom).toBe(window.innerHeight / 2);
        }
    ));

    it("Should fit bounds for large screen and not use the small padding", inject([MapService],
        async (service: MapService) => {
            const spy = vi.fn();
            service.setMap({
                fitBounds: spy,
                setMissingStyleImageResolver: () => { },
                on: () => { },
                getZoom: () => 1
            } as unknown as Map);
            const originalInnerWidth = (window as { innerWidth: number }).innerWidth;
            (window as { innerWidth: number }).innerWidth = 1000;
            await service.fitBounds({ northEast: { lat: 1, lng: 1 }, southWest: { lat: 2, lng: 2 } }, 0, { bottom: 100 });
            (window as { innerWidth: number }).innerWidth = originalInnerWidth;
            expect(vi.mocked(spy).mock.calls[0][1].padding).toBe(0);
        }
    ));

    it("Should not fly to on small changes", inject([MapService],
        async (service: MapService) => {
            const spy = vi.fn();
            service.setMap({
                getCenter: () => {
                    return { lat: 1, lng: 1 };
                },
                flyTo: spy,
                setMissingStyleImageResolver: () => { },
                on: () => { },
                getZoom: () => 1
            } as unknown as Map);
            await service.flyTo({ lng: 1, lat: 1 }, 1);
            expect(spy).not.toHaveBeenCalled();
        }
    ));

    it("Should fly to on large changes", inject([MapService],
        async (service: MapService) => {
            const spy = vi.fn();
            service.setMap({
                getCenter: () => {
                    return { lat: 1, lng: 1 };
                },
                flyTo: spy,
                setMissingStyleImageResolver: () => { },
                on: () => { }
            } as unknown as Map);
            await service.flyTo({ lng: 2, lat: 2 }, 1);
            expect(spy).toHaveBeenCalled();
        }
    ));

    it("Should use current zoom if not provided", inject([MapService],
        async (service: MapService) => {
            const spy = vi.fn();
            service.setMap({
                getCenter: () => {
                    return { lat: 1, lng: 1 };
                },
                flyTo: spy,
                setMissingStyleImageResolver: () => { },
                on: () => { },
                getZoom: () => 1
            } as unknown as Map);
            await service.flyTo({ lng: 2, lat: 2 });
            expect(spy).toHaveBeenCalled();
            expect(vi.mocked(spy).mock.calls[0][0].zoom).toBe(1);
        }
    ));

    it("Should move to with current zoom", inject([MapService],
        async (service: MapService) => {
            const spy = vi.fn();
            service.setMap({
                easeTo: spy,
                setMissingStyleImageResolver: () => { },
                on: () => { },
                getZoom: () => 1
            } as unknown as Map);
            await service.moveToWithCurrentZoom({ lng: 2, lat: 2 }, 1);
            expect(spy).toHaveBeenCalled();
            expect(vi.mocked(spy).mock.calls[0][0].zoom).toBe(1);
        }
    ));

    it("Should not move to with current zoom after map was removed", inject([MapService],
        async (service: MapService) => {
            const spy = vi.fn();
            service.setMap({
                easeTo: spy,
                setMissingStyleImageResolver: () => { },
                on: () => { },
                getZoom: () => 1,
                off: () => { }
            } as unknown as Map);
            service.unsetMap();
            await service.moveToWithCurrentZoom({ lng: 2, lat: 2 }, 1);
            expect(spy).not.toHaveBeenCalled();
        }
    ));

    it("should call map's add layer", inject([MapService],
        async (service: MapService) => {
            const spy = vi.fn();
            service.setMap({
                setMissingStyleImageResolver: () => { },
                on: () => { },
                addLayer: spy
            } as unknown as Map);
            service.addLayer({ id: "layer1" } as unknown as LayerSpecification);
            expect(spy).toHaveBeenCalled();
        }
    ));

    it("should call map's add source", inject([MapService],
        async (service: MapService) => {
            const spy = vi.fn();
            service.setMap({
                setMissingStyleImageResolver: () => { },
                on: () => { },
                addSource: spy
            } as unknown as Map);
            service.addSource("source1", {} as unknown as SourceSpecification);
            expect(spy).toHaveBeenCalled();
        }
    ));
});
