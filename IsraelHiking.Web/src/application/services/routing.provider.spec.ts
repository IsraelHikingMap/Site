import { describe, beforeEach, vi, it, expect } from "vitest";
import { TestBed, inject } from "@angular/core/testing";
import { provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { provideStore, Store } from "@ngxs/store";
import polyline from "@mapbox/polyline";

import { RoutingProvider } from "./routing.provider";
import { InMemoryReducer } from "../reducers/in-memory.reducer";
import { ResourcesService } from "./resources.service";
import { ToastService } from "./toast.service";
import { GeoJsonParser } from "./geojson.parser";
import { LoggingService } from "./logging.service";
import { RunningContextService } from "./running-context.service";
import { ElevationProvider } from "./elevation.provider";
import { SpatialService } from "./spatial.service";

const encodeShape = (latlngs: [number, number][]) => polyline.encode(latlngs, 6);

const sliceKeyOf = (lat: number, lng: number) => {
    const tile = SpatialService.toTile({ lat, lng }, 7);
    return `${Math.floor(tile.x)}-${Math.floor(tile.y)}`;
};

describe("RoutingProvider", () => {
    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                provideStore([InMemoryReducer]),
                {
                    provide: ResourcesService,
                    useValue: {
                        routingFailed: "routing-failed",
                        routingFailedBuySubscription: "buy-subscription",
                        routingFailedDownloadTheArea: "download-the-area"
                    }
                },
                { provide: ToastService, useValue: { warning: vi.fn() } },
                { provide: LoggingService, useValue: { error: () => { }, info: () => { } } },
                { provide: RunningContextService, useValue: { isCapacitor: false } },
                { provide: ElevationProvider, useValue: { updateHeights: () => Promise.resolve() } },
                GeoJsonParser,
                RoutingProvider,
                provideHttpClient(withInterceptorsFromDi()),
                provideHttpClientTesting()
            ]
        });
    });

    it("Should route between two distant points with None routing type", inject([RoutingProvider, HttpTestingController],
        async (router: RoutingProvider, mockBackend: HttpTestingController) => {
            const promise = router.getRoute({ lat: 32, lng: 35 }, { lat: 33, lng: 35 }, "None");

            mockBackend.expectNone(() => true);
            const data = await promise;
            expect(data.length).toBe(101);
            expect(data[0].lat).toBe(32);
            expect(data[0].lng).toBe(35);
            expect(data[data.length - 1].lat).toBe(33);
            expect(data[data.length - 1].lng).toBe(35);
        }
    ));

    it("Should route between two close points with None routing type", inject([RoutingProvider, HttpTestingController],
        async (router: RoutingProvider, mockBackend: HttpTestingController) => {
            const promise = router.getRoute({ lat: 32, lng: 35 }, { lat: 32.0001, lng: 35.0001 }, "None");

            mockBackend.expectNone(() => true);
            const data = await promise;
            expect(data.length).toBe(2);
            expect(data[0].lat).toBe(32);
            expect(data[0].lng).toBe(35);
            expect(data[1].lat).toBe(32.0001);
            expect(data[1].lng).toBe(35.0001);
        }
    ));

    it("Should route between two points", inject([RoutingProvider, HttpTestingController],
        async (router: RoutingProvider, mockBackend: HttpTestingController) => {
            const promise = router.getRoute({ lat: 32, lng: 35 }, { lat: 33, lng: 35 }, "Hike");

            mockBackend.expectOne(() => true).flush({
                type: "FeatureCollection",
                features: [
                    {
                        type: "Feature",
                        properties: {
                            name: "name"
                        },
                        geometry: {
                            type: "LineString",
                            coordinates: [
                                [1, 1],
                                [1.5, 1.5],
                                [2, 2]
                            ]
                        } as GeoJSON.LineString
                    } as GeoJSON.Feature<GeoJSON.LineString>
                ]
            } as GeoJSON.FeatureCollection<GeoJSON.GeometryObject>);
            const data = await promise;
            expect(data.length).toBe(3);
        }
    ));

    it("Should return start and end points when reponse is not a geojson", inject([RoutingProvider, HttpTestingController, Store],
        async (router: RoutingProvider, mockBackend: HttpTestingController, store: Store) => {
            store.reset({
                offlineState: { isSubscribed: false },
                inMemoryState: { downloadedRoutingTiles: [] }
            });

            const promise = router.getRoute({ lat: 32, lng: 35 }, { lat: 33, lng: 35 }, "Hike");

            mockBackend.expectOne(() => true).flush({});
            const data = await promise;
            expect(data.length).toBe(2);
        }
    ));

    it("Should return start and end points when getting error response from server and there is no offline routing",
        inject([RoutingProvider, HttpTestingController, Store],
            async (router: RoutingProvider, mockBackend: HttpTestingController, store: Store) => {
                store.reset({
                    offlineState: { isSubscribed: false },
                    inMemoryState: { downloadedRoutingTiles: [] }
                });

                const promise = router.getRoute({ lat: 32, lng: 35 }, { lat: 32.001, lng: 35.001 }, "Hike");

                mockBackend.expectOne(() => true).flush(null, { status: 500, statusText: "Server error" });
                const data = await promise;
                expect(data.length).toBe(2);
            }
        )
    );

    it("Should warn the user when routing fails and there is no offline routing",
        inject([RoutingProvider, HttpTestingController, Store, ToastService],
            async (router: RoutingProvider, mockBackend: HttpTestingController, store: Store, toastService: ToastService) => {
                store.reset({
                    offlineState: { isSubscribed: false },
                    inMemoryState: { downloadedRoutingTiles: [] }
                });

                const promise = router.getRoute({ lat: 32, lng: 35 }, { lat: 32.001, lng: 35.001 }, "Hike");

                mockBackend.expectOne(() => true).flush(null, { status: 500, statusText: "Server error" });
                await promise;
                expect(toastService.warning).toHaveBeenCalled();
            }
        )
    );

    it("Should suggest buying a subscription when the user is not subscribed",
        inject([RoutingProvider, HttpTestingController, Store, ToastService, RunningContextService],
            async (router: RoutingProvider, mockBackend: HttpTestingController, store: Store, toastService: ToastService,
                runningContextService: RunningContextService) => {
                (runningContextService as { isCapacitor: boolean }).isCapacitor = true;
                store.reset({
                    offlineState: { isSubscribed: false },
                    inMemoryState: { downloadedRoutingTiles: [] }
                });

                const promise = router.getRoute({ lat: 32, lng: 35 }, { lat: 32.001, lng: 35.001 }, "Hike");

                mockBackend.expectOne(() => true).flush(null, { status: 500, statusText: "Server error" });
                await promise;
                expect(toastService.warning).toHaveBeenCalledWith("buy-subscription");
            }
        )
    );

    it("Should suggest downloading the area when it was never downloaded",
        inject([RoutingProvider, HttpTestingController, Store, ToastService, RunningContextService],
            async (router: RoutingProvider, mockBackend: HttpTestingController, store: Store, toastService: ToastService,
                runningContextService: RunningContextService) => {
                (runningContextService as { isCapacitor: boolean }).isCapacitor = true;
                store.reset({
                    offlineState: { isSubscribed: true },
                    inMemoryState: { downloadedRoutingTiles: [] }
                });

                const promise = router.getRoute({ lat: 32, lng: 35 }, { lat: 32.001, lng: 35.001 }, "Hike");

                mockBackend.expectOne(() => true).flush(null, { status: 500, statusText: "Server error" });
                await promise;
                expect(toastService.warning).toHaveBeenCalledWith("download-the-area");
            }
        )
    );

    it("Should suggest downloading the area when it holds no routing tiles",
        inject([RoutingProvider, HttpTestingController, Store, ToastService, RunningContextService],
            async (router: RoutingProvider, mockBackend: HttpTestingController, store: Store, toastService: ToastService,
                runningContextService: RunningContextService) => {
                (runningContextService as { isCapacitor: boolean }).isCapacitor = true;
                store.reset({
                    offlineState: { isSubscribed: true },
                    inMemoryState: { downloadedRoutingTiles: [] }
                });

                const promise = router.getRoute({ lat: 32, lng: 35 }, { lat: 32.001, lng: 35.001 }, "Hike");

                mockBackend.expectOne(() => true).flush(null, { status: 500, statusText: "Server error" });
                await promise;
                expect(toastService.warning).toHaveBeenCalledWith("download-the-area");
            }
        )
    );

    it("Should only say that routing failed when the area and its routing tiles are there",
        inject([RoutingProvider, HttpTestingController, Store, ToastService, RunningContextService],
            async (router: RoutingProvider, mockBackend: HttpTestingController, store: Store, toastService: ToastService,
                runningContextService: RunningContextService) => {
                (runningContextService as { isCapacitor: boolean }).isCapacitor = true;
                store.reset({
                    offlineState: { isSubscribed: true },
                    inMemoryState: { downloadedRoutingTiles: [sliceKeyOf(32, 35), sliceKeyOf(32.001, 35.001)] }
                });

                const promise = router.getRoute({ lat: 32, lng: 35 }, { lat: 32.001, lng: 35.001 }, "Hike");

                mockBackend.expectOne(() => true).flush(null, { status: 500, statusText: "Server error" });
                await promise;
                expect(toastService.warning).toHaveBeenCalledWith("routing-failed");
            }
        )
    );

    it("Should decode the shape of an offline route", () => {
        const raw = JSON.stringify({
            trip: { legs: [{ shape: encodeShape([[32, 35], [32.001, 35.001], [32.002, 35.002]]) }] }
        });

        const latlngs = RoutingProvider.parseValhallaResponse(raw);

        expect(latlngs.length).toBe(3);
        expect(latlngs[0].lat).toBeCloseTo(32, 5);
        expect(latlngs[0].lng).toBeCloseTo(35, 5);
        expect(latlngs[2].lat).toBeCloseTo(32.002, 5);
    });

    it("Should concatenate the legs of an offline route", () => {
        const raw = JSON.stringify({
            trip: {
                legs: [
                    { shape: encodeShape([[32, 35], [32.001, 35.001]]) },
                    { shape: encodeShape([[32.001, 35.001], [32.002, 35.002]]) }
                ]
            }
        });

        expect(RoutingProvider.parseValhallaResponse(raw).length).toBe(4);
    });

    it("Should set the elevation of an offline route from the samples", () => {
        // Two points 30 meters apart, i.e. exactly one elevation interval
        const raw = JSON.stringify({
            trip: { legs: [{ shape: encodeShape([[32, 35], [32.00027, 35]]), elevation: [100, 130] }] }
        });

        const latlngs = RoutingProvider.parseValhallaResponse(raw);

        expect(latlngs[0].alt).toBe(100);
        expect(latlngs[1].alt).toBeCloseTo(130, 0);
    });

    it("Should interpolate the elevation of an offline route between two samples", () => {
        // The middle point is roughly half an interval in, so its elevation is between the samples
        const raw = JSON.stringify({
            trip: {
                legs: [{
                    shape: encodeShape([[32, 35], [32.000135, 35], [32.00027, 35]]),
                    elevation: [100, 200]
                }]
            }
        });

        const latlngs = RoutingProvider.parseValhallaResponse(raw);

        expect(latlngs[1].alt).toBeGreaterThan(100);
        expect(latlngs[1].alt).toBeLessThan(200);
    });

    it("Should not set the elevation of an offline route when there are no samples", () => {
        const raw = JSON.stringify({
            trip: { legs: [{ shape: encodeShape([[32, 35], [32.002, 35.002]]) }] }
        });

        expect(RoutingProvider.parseValhallaResponse(raw).every(l => l.alt == null)).toBe(true);
    });

    it("Should throw when valhalla returns an error", () => {
        const raw = JSON.stringify({ code: 171, message: "No suitable edges near location" });

        expect(() => RoutingProvider.parseValhallaResponse(raw)).toThrow("No suitable edges near location");
    });
});
