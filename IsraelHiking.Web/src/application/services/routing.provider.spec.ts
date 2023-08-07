import { TestBed, inject } from "@angular/core/testing";
import { HttpClientModule } from "@angular/common/http";
import { HttpClientTestingModule, HttpTestingController } from "@angular/common/http/testing";
import { NgxsModule, Store } from "@ngxs/store";
import geojsonVt from "geojson-vt";
import vtpbf from "vt-pbf";
import polyline from "@mapbox/polyline";

import { RoutingProvider } from "./routing.provider";
import { ResourcesService } from "./resources.service";
import { ToastService } from "./toast.service";
import { GeoJsonParser } from "./geojson.parser";
import { ToastServiceMockCreator } from "./toast.service.spec";
import { DatabaseService } from "./database.service";
import { LoggingService } from "./logging.service";
import { RunningContextService } from "./running-context.service";
import { SpatialService } from "./spatial.service";

const createTileFromFeatureCollection = (featureCollection: GeoJSON.FeatureCollection): ArrayBuffer => {
    const tileindex = geojsonVt(featureCollection);
    const feature = featureCollection.features[0];
    let coordinate = [0, 0];
    if (feature.geometry.type === "LineString") {
        coordinate = feature.geometry.coordinates[0];
    } else if (feature.geometry.type === "MultiLineString") {
        coordinate = feature.geometry.coordinates[0][0];
    }
    const xy = SpatialService.toTile(SpatialService.toLatLng(coordinate), 14)
    const tile = tileindex.getTile(14, Math.floor(xy.x), Math.floor(xy.y));
    return vtpbf.fromGeojsonVt({ geojsonLayer: tile });

};

describe("RoutingProvider", () => {
    beforeEach(() => {
        const toastMockCreator = new ToastServiceMockCreator();
        TestBed.configureTestingModule({
            imports: [
                HttpClientModule,
                HttpClientTestingModule,
                NgxsModule.forRoot([])
            ],
            providers: [
                { provide: ResourcesService, useValue: toastMockCreator.resourcesService },
                { provide: ToastService, useValue: toastMockCreator.toastService },
                { provide: DatabaseService, usevalue: {} },
                { provide: LoggingService, useValue: { error: () => {} } },
                { provide: RunningContextService, useValue: {} },
                GeoJsonParser,
                RoutingProvider
            ]
        });
    });

    it("Should route between two points inside Israel", inject([RoutingProvider, HttpTestingController],
        async (router: RoutingProvider, mockBackend: HttpTestingController) => {
            const promise = router.getRoute({ lat: 32, lng: 35 }, { lat: 33, lng: 35 }, "Hike").then((data) => {
                expect(data.length).toBe(3);
            }, fail);

            mockBackend.expectOne(() => true).flush(
                {
                    type: "FeatureCollection",
                    features: [
                        {
                            type: "Feature",
                            properties: {
                                name: "name"
                            },
                            geometry: {
                                type: "LineString",
                                coordinates: [[1, 1] as GeoJSON.Position, [1.5, 1.5], [2, 2]]
                            } as GeoJSON.LineString
                        } as GeoJSON.Feature<GeoJSON.LineString>
                    ]
                } as GeoJSON.FeatureCollection<GeoJSON.GeometryObject>);
            return promise;
        }
    ));

    it("Should route between two points outside Israel", inject([RoutingProvider, HttpTestingController],
        async (router: RoutingProvider, mockBackend: HttpTestingController) => {
            const promise = router.getRoute({ lat: 0, lng: 0 }, { lat: 1, lng: 1 }, "Hike").then((data) => {
                expect(data.length).toBe(3);
            }, fail);

            mockBackend.expectOne(u => u.url.startsWith("https://valhalla")).flush({
                trip: {
                    legs:[{
                        shape: polyline.encode([[1, 1], [1.5, 1.5], [2, 2]], 6)
                    }]
                }
            });
            return promise;
        }
    ));

    it("Should return start and end points when reponse is not a geojson", inject([RoutingProvider, HttpTestingController, Store],
        async (router: RoutingProvider, mockBackend: HttpTestingController, store: Store) => {
            store.reset({
                offlineState: {
                    isOfflineAvailable: false
                }
            });

            const promise = router.getRoute({ lat: 32, lng: 35 }, { lat: 33, lng: 35 }, "Hike").then((data) => {
                expect(data.length).toBe(2);
            }, fail);

            mockBackend.expectOne(() => true).flush({});
            return promise;
        }
    ));

    it("Should return straight route from tiles when getting error response from server and no offline subscription",
        inject([RoutingProvider, HttpTestingController, Store],
        async (router: RoutingProvider, mockBackend: HttpTestingController, store: Store) => {
            store.reset({
                offlineState: {
                    isOfflineAvailable: false
                }
            });

            const promise = router.getRoute({ lat: 32, lng: 35 }, { lat: 32.001, lng: 35.001 }, "Hike").then((data) => {
                expect(data.length).toBe(2);
            }, fail);

            mockBackend.expectOne(() => true).flush(null, { status: 500, statusText: "Server error" });
            return promise;
        }
    ));

    it("Should return start and end points when getting error response from server and offline is missing",
        inject([RoutingProvider, HttpTestingController, Store],
        async (router: RoutingProvider, mockBackend: HttpTestingController, store: Store) => {

            store.reset({
                offlineState: {
                    isOfflineAvailable: true,
                    lastModifiedDate: null
                }
            });

            const promise = router.getRoute({ lat: 32, lng: 35 }, { lat: 32.001, lng: 35.001 }, "Hike").then((data) => {
                expect(data.length).toBe(2);
            }, fail);

            mockBackend.expectOne(() => true).flush(null, { status: 500, statusText: "Server error" });
            return promise;
        }
    ));

    it("Should return start and end points when getting error response from server and the points are too far part",
        inject([RoutingProvider, HttpTestingController, Store],
        async (router: RoutingProvider, mockBackend: HttpTestingController, store: Store) => {

            store.reset({
                offlineState: {
                    isOfflineAvailable: true,
                    lastModifiedDate: new Date()
                }
            });

            const promise = router.getRoute({ lat: 32, lng: 35 }, { lat: 33, lng: 35 }, "Hike").then((data) => {
                expect(data.length).toBe(2);
            }, fail);

            mockBackend.expectOne(() => true).flush(null, { status: 500, statusText: "Server error" });
            return promise;
        }
    ));

    it("Should return a route when getting error response from server and offline is available",
        inject([RoutingProvider, HttpTestingController, DatabaseService, Store],
        async (router: RoutingProvider, mockBackend: HttpTestingController, db: DatabaseService, store: Store) => {

            const featureCollection = {
                type: "FeatureCollection",
                features: [{
                    type: "Feature",
                    geometry: {
                        type: "LineString",
                        coordinates: [[35.0001,32.0001], [35.0001,32.0002], [35.0001,32.0003]]
                    },
                    properties: {
                        ihm_class: "track"
                    }
                }]
            } as GeoJSON.FeatureCollection;

            db.getTile = () =>  Promise.resolve(createTileFromFeatureCollection(featureCollection));

            store.reset({
                offlineState: {
                    isOfflineAvailable: true,
                    lastModifiedDate: new Date()
                }
            });

            const promise = router.getRoute({ lat: 32.0001, lng: 35.0001 }, { lat: 32.0005, lng: 35.0001 }, "Hike").then((data) => {
                expect(data.length).toBe(3);
            }, fail);

            mockBackend.expectOne(() => true).flush(null, { status: 500, statusText: "Server error" });
            return promise;
        }
    ));

    it("Should return a route when getting error response from server and offline is available for a multiline string",
        inject([RoutingProvider, HttpTestingController, DatabaseService, Store],
        async (router: RoutingProvider, mockBackend: HttpTestingController, db: DatabaseService, store: Store) => {

            const featureCollection = {
                type: "FeatureCollection",
                features: [{
                    type: "Feature",
                    geometry: {
                        type: "MultiLineString",
                        coordinates: [
                            [[35.0001,32.0001], [35.0001,32.0002], [35.0001,32.0003]],
                            [[35.0001,32.0003], [35.0002,32.0003], [35.0003,32.0003]]
                        ]
                    },
                    properties: {
                        ihm_class: "track"
                    }
                }]
            } as GeoJSON.FeatureCollection;

            db.getTile = () =>  Promise.resolve(createTileFromFeatureCollection(featureCollection));

            store.reset({
                offlineState: {
                    isOfflineAvailable: true,
                    lastModifiedDate: new Date()
                }
            });

            const promise = router.getRoute({ lat: 32.0001, lng: 35.0001 }, { lat: 32.0005, lng: 35.0005 }, "Hike").then((data) => {
                expect(data.length).toBe(5);
            }, fail);

            mockBackend.expectOne(() => true).flush(null, { status: 500, statusText: "Server error" });
            return promise;
        }
    ));

    it("Should return a route when getting error response from server and offline is available only through one line",
        inject([RoutingProvider, HttpTestingController, DatabaseService, Store],
        async (router: RoutingProvider, mockBackend: HttpTestingController, db: DatabaseService, store: Store) => {

            const featureCollection = {
                type: "FeatureCollection",
                features: [{
                    type: "Feature",
                    geometry: {
                        type: "LineString",
                        coordinates: [[35.0001,32.0001], [35.0001,32.0002], [35.0001,32.0003]]
                    },
                    properties: {
                        ihm_class: "track"
                    }
                }, {
                    type: "Feature",
                    geometry: {
                        type: "LineString",
                        coordinates: [[35.0001,32.0003], [35.0002,32.0003], [35.0003,32.0003]]
                    },
                    properties: {
                        ihm_class: "steps"
                    }
                }]
            } as GeoJSON.FeatureCollection;

            db.getTile = () =>  Promise.resolve(createTileFromFeatureCollection(featureCollection));

            store.reset({
                offlineState: {
                    isOfflineAvailable: true,
                    lastModifiedDate: new Date()
                }
            });

            const promise = router.getRoute({ lat: 32.0001, lng: 35.0001 }, { lat: 32.0005, lng: 35.0005 }, "Bike").then((data) => {
                expect(data.length).toBe(3);
            }, fail);

            mockBackend.expectOne(() => true).flush(null, { status: 500, statusText: "Server error" });
            return promise;
        }
    ));

    it("Should return srart and end point when all lines are filtered out",
        inject([RoutingProvider, HttpTestingController, DatabaseService, Store],
        async (router: RoutingProvider, mockBackend: HttpTestingController, db: DatabaseService, store: Store) => {

            const featureCollection = {
                type: "FeatureCollection",
                features: [{
                    type: "Feature",
                    geometry: {
                        type: "LineString",
                        coordinates: [[35.0001,32.0003], [35.0002,32.0003], [35.0003,32.0003]]
                    },
                    properties: {
                        ihm_class: "path"
                    }
                }]
            } as GeoJSON.FeatureCollection;

            db.getTile = () =>  Promise.resolve(createTileFromFeatureCollection(featureCollection));

            store.reset({
                offlineState: {
                    isOfflineAvailable: true,
                    lastModifiedDate: new Date()
                }
            });

            const promise = router.getRoute({ lat: 32.0001, lng: 35.0001 }, { lat: 32.0005, lng: 35.0005 }, "4WD").then((data) => {
                expect(data.length).toBe(2);
            }, fail);

            mockBackend.expectOne(() => true).flush(null, { status: 500, statusText: "Server error" });
            return promise;
        }
    ));

    it("Should return a route between two lines when points are not exactly the same",
        inject([RoutingProvider, HttpTestingController, DatabaseService, Store],
        async (router: RoutingProvider, mockBackend: HttpTestingController, db: DatabaseService, store: Store) => {
            const featureCollection = {
                type: "FeatureCollection",
                features: [{
                    type: "Feature",
                    geometry: {
                        type: "LineString",
                        coordinates: [[35.0001,32.0001], [35.0001,32.0002], [35.0001,32.0003]]
                    },
                    properties: {
                        ihm_class: "major"
                    }
                }, {
                    type: "Feature",
                    geometry: {
                        type: "LineString",
                        coordinates: [[35.0001,32.000305], [35.0002,32.0003], [35.0003,32.0003]]
                    },
                    properties: {
                        ihm_class: "minor"
                    }
                }]
            } as GeoJSON.FeatureCollection;

            db.getTile = () =>  Promise.resolve(createTileFromFeatureCollection(featureCollection));

            store.reset({
                offlineState: {
                    isOfflineAvailable: true,
                    lastModifiedDate: new Date()
                }
            });

            const promise = router.getRoute({ lat: 32.0001, lng: 35.0001 }, { lat: 32.0005, lng: 35.0005 }, "Bike").then((data) => {
                expect(data.length).toBe(5);
            }, fail);

            mockBackend.expectOne(() => true).flush(null, { status: 500, statusText: "Server error" });
            return promise;
        }
    ));
});
