import { describe, beforeEach, vi, it, expect } from "vitest";
import { TestBed, inject } from "@angular/core/testing";
import { provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { provideStore, Store } from "@ngxs/store";
import polyline from "@mapbox/polyline";

import { RoutingProvider } from "./routing.provider";
import { ResourcesService } from "./resources.service";
import { ToastService } from "./toast.service";
import { GeoJsonParser } from "./geojson.parser";
import { LoggingService } from "./logging.service";
import { RunningContextService } from "./running-context.service";
import { ElevationProvider } from "./elevation.provider";
import { VALHALLA_PLUGIN } from "./valhalla.plugin";
import type { ValhallaPlugin } from "./valhalla.plugin";

const encodeShape = (latlngs: [number, number][]) => polyline.encode(latlngs, 6);

const setupTestBed = (isCapacitor: boolean, pluginMock: ValhallaPlugin) => {
    TestBed.configureTestingModule({
        providers: [
            provideStore([]),
            { provide: ResourcesService, useValue: {} },
            {
                provide: ToastService,
                useValue: {
                    warning: vi.fn()
                }
            },
            { provide: LoggingService, useValue: { error: () => { }, info: () => { } } },
            { provide: RunningContextService, useValue: { isCapacitor } },
            { provide: VALHALLA_PLUGIN, useValue: pluginMock },
            {
                provide: ElevationProvider,
                useValue: {
                    updateHeights: () => Promise.resolve()
                }
            },
            GeoJsonParser,
            RoutingProvider,
            provideHttpClient(withInterceptorsFromDi()),
            provideHttpClientTesting()
        ]
    });
};

describe("RoutingProvider", () => {
    let pluginMock: ValhallaPlugin;

    beforeEach(() => {
        pluginMock = {
            route: vi.fn(),
            extractTiles: vi.fn(),
            deleteTiles: vi.fn(),
            hasTiles: vi.fn().mockResolvedValue({ hasTiles: false }),
            clearTiles: vi.fn()
        };
        setupTestBed(true, pluginMock);
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
                offlineState: {
                    isSubscribed: false
                }
            });

            const promise = router.getRoute({ lat: 32, lng: 35 }, { lat: 33, lng: 35 }, "Hike");

            mockBackend.expectOne(() => true).flush({});
            const data = await promise;
            expect(data.length).toBe(2);
        }
    ));

    it("Should return start and end points when getting error response from server and there are no offline tiles",
        inject([RoutingProvider, HttpTestingController, Store],
            async (router: RoutingProvider, mockBackend: HttpTestingController, store: Store) => {
                store.reset({
                    offlineState: {
                        isSubscribed: false
                    }
                });

                const promise = router.getRoute({ lat: 32, lng: 35 }, { lat: 32.001, lng: 35.001 }, "Hike");

                mockBackend.expectOne(() => true).flush(null, { status: 500, statusText: "Server error" });
                const data = await promise;
                expect(data.length).toBe(2);
                expect(pluginMock.route).not.toHaveBeenCalled();
            }
        )
    );

    it("Should warn the user when routing fails and there are no offline tiles",
        inject([RoutingProvider, HttpTestingController, Store, ToastService],
            async (router: RoutingProvider, mockBackend: HttpTestingController, store: Store, toastService: ToastService) => {
                store.reset({
                    offlineState: {
                        isSubscribed: false
                    }
                });

                const promise = router.getRoute({ lat: 32, lng: 35 }, { lat: 32.001, lng: 35.001 }, "Hike");

                mockBackend.expectOne(() => true).flush(null, { status: 500, statusText: "Server error" });
                await promise;
                expect(toastService.warning).toHaveBeenCalled();
            }
        )
    );

    describe("Offline routing", () => {
        const routeOffline = async (router: RoutingProvider, mockBackend: HttpTestingController,
            routingType: "Hike" | "Bike" | "4WD" = "Hike") => {
            vi.mocked(pluginMock.hasTiles).mockResolvedValue({ hasTiles: true });
            const promise = router.getRoute({ lat: 32, lng: 35 }, { lat: 32.002, lng: 35.002 }, routingType);
            mockBackend.expectOne(() => true).flush(null, { status: 500, statusText: "Server error" });
            return promise;
        };

        it("Should map the routing type to a costing model", inject([RoutingProvider, HttpTestingController],
            async (router: RoutingProvider, mockBackend: HttpTestingController) => {
                vi.mocked(pluginMock.route).mockResolvedValue({
                    raw: JSON.stringify({ trip: { legs: [{ shape: encodeShape([[32, 35], [32.002, 35.002]]) }] } })
                });

                await routeOffline(router, mockBackend, "Hike");
                expect(vi.mocked(pluginMock.route).mock.calls[0][0].costing).toBe("pedestrian");

                await routeOffline(router, mockBackend, "Bike");
                expect(vi.mocked(pluginMock.route).mock.calls[1][0].costing).toBe("bicycle");

                await routeOffline(router, mockBackend, "4WD");
                expect(vi.mocked(pluginMock.route).mock.calls[2][0].costing).toBe("auto");
            }
        ));

        it("Should decode the route shape", inject([RoutingProvider, HttpTestingController],
            async (router: RoutingProvider, mockBackend: HttpTestingController) => {
                vi.mocked(pluginMock.route).mockResolvedValue({
                    raw: JSON.stringify({
                        trip: { legs: [{ shape: encodeShape([[32, 35], [32.001, 35.001], [32.002, 35.002]]) }] }
                    })
                });

                const latlngs = await routeOffline(router, mockBackend);

                expect(latlngs.length).toBe(3);
                expect(latlngs[0].lat).toBeCloseTo(32, 5);
                expect(latlngs[0].lng).toBeCloseTo(35, 5);
                expect(latlngs[2].lat).toBeCloseTo(32.002, 5);
            }
        ));

        it("Should concatenate the legs of the route", inject([RoutingProvider, HttpTestingController],
            async (router: RoutingProvider, mockBackend: HttpTestingController) => {
                vi.mocked(pluginMock.route).mockResolvedValue({
                    raw: JSON.stringify({
                        trip: {
                            legs: [
                                { shape: encodeShape([[32, 35], [32.001, 35.001]]) },
                                { shape: encodeShape([[32.001, 35.001], [32.002, 35.002]]) }
                            ]
                        }
                    })
                });

                const latlngs = await routeOffline(router, mockBackend);

                expect(latlngs.length).toBe(4);
            }
        ));

        it("Should set the elevation of the points from the samples", inject([RoutingProvider, HttpTestingController],
            async (router: RoutingProvider, mockBackend: HttpTestingController) => {
                // Two points 30 meters apart, i.e. exactly one elevation interval
                vi.mocked(pluginMock.route).mockResolvedValue({
                    raw: JSON.stringify({
                        trip: { legs: [{ shape: encodeShape([[32, 35], [32.00027, 35]]), elevation: [100, 130] }] }
                    })
                });

                const latlngs = await routeOffline(router, mockBackend);

                expect(latlngs[0].alt).toBe(100);
                expect(latlngs[1].alt).toBeCloseTo(130, 0);
            }
        ));

        it("Should interpolate the elevation between two samples", inject([RoutingProvider, HttpTestingController],
            async (router: RoutingProvider, mockBackend: HttpTestingController) => {
                // The middle point is roughly half an interval in, so its elevation is between the samples
                vi.mocked(pluginMock.route).mockResolvedValue({
                    raw: JSON.stringify({
                        trip: {
                            legs: [{
                                shape: encodeShape([[32, 35], [32.000135, 35], [32.00027, 35]]),
                                elevation: [100, 200]
                            }]
                        }
                    })
                });

                const latlngs = await routeOffline(router, mockBackend);

                expect(latlngs[1].alt).toBeGreaterThan(100);
                expect(latlngs[1].alt).toBeLessThan(200);
            }
        ));

        it("Should not set the elevation when there are no samples", inject([RoutingProvider, HttpTestingController],
            async (router: RoutingProvider, mockBackend: HttpTestingController) => {
                vi.mocked(pluginMock.route).mockResolvedValue({
                    raw: JSON.stringify({ trip: { legs: [{ shape: encodeShape([[32, 35], [32.002, 35.002]]) }] } })
                });

                const latlngs = await routeOffline(router, mockBackend);

                expect(latlngs.every(l => l.alt == null)).toBe(true);
            }
        ));

        it("Should return start and end points when valhalla returns an error", inject([RoutingProvider, HttpTestingController, Store],
            async (router: RoutingProvider, mockBackend: HttpTestingController, store: Store) => {
                store.reset({
                    offlineState: {
                        isSubscribed: true
                    }
                });
                vi.mocked(pluginMock.route).mockResolvedValue({
                    raw: JSON.stringify({ code: 171, message: "No suitable edges near location" })
                });

                const latlngs = await routeOffline(router, mockBackend);

                expect(latlngs.length).toBe(2);
            }
        ));

        it("Should not route offline when it is not supported", async () => {
            TestBed.resetTestingModule();
            setupTestBed(false, pluginMock);
            const router = TestBed.inject(RoutingProvider);
            const backend = TestBed.inject(HttpTestingController);
            TestBed.inject(Store).reset({ offlineState: { isSubscribed: false } });
            vi.mocked(pluginMock.hasTiles).mockResolvedValue({ hasTiles: true });

            const promise = router.getRoute({ lat: 32, lng: 35 }, { lat: 32.002, lng: 35.002 }, "Hike");
            backend.expectOne(() => true).flush(null, { status: 500, statusText: "Server error" });
            await promise;

            expect(pluginMock.route).not.toHaveBeenCalled();
        });

        it("Should extract downloaded tiles", inject([RoutingProvider],
            async (router: RoutingProvider) => {
                vi.mocked(pluginMock.extractTiles).mockResolvedValue({ extractedFiles: 42, tilesDir: "/data/valhalla_tiles" });

                await router.extractOfflineRoutingTiles("valhalla+7-52-75.tar", "52-75");

                expect(pluginMock.extractTiles).toHaveBeenCalledWith({ tarFileName: "valhalla+7-52-75.tar", sliceId: "52-75" });
            }
        ));

        it("Should delete the tiles of a single slice", inject([RoutingProvider],
            async (router: RoutingProvider) => {
                await router.deleteOfflineRoutingTiles("52-75");

                expect(pluginMock.deleteTiles).toHaveBeenCalledWith({ sliceId: "52-75" });
            }
        ));

        it("Should not ask the plugin to delete tiles when it is not supported", async () => {
            TestBed.resetTestingModule();
            setupTestBed(false, pluginMock);

            await TestBed.inject(RoutingProvider).deleteOfflineRoutingTiles("52-75");

            expect(pluginMock.deleteTiles).not.toHaveBeenCalled();
        });
    });
});
