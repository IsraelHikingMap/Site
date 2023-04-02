import { TestBed, inject } from "@angular/core/testing";
import { HttpClientModule } from "@angular/common/http";
import { HttpClientTestingModule, HttpTestingController } from "@angular/common/http/testing";
import { MockNgRedux, MockNgReduxModule } from "@angular-redux2/store/testing";

import { RouterService } from "./router.service";
import { ResourcesService } from "./resources.service";
import { ToastService } from "./toast.service";
import { GeoJsonParser } from "./geojson.parser";
import { ToastServiceMockCreator } from "./toast.service.spec";
import { DatabaseService } from "./database.service";
import { LoggingService } from "./logging.service";
import { RunningContextService } from "./running-context.service";
import geojsonVt from "geojson-vt";
import vtpbf from "vt-pbf";

const createTileFromFeatureCollection = (featureCollection: GeoJSON.FeatureCollection): ArrayBuffer => {
    let tileindex = geojsonVt(featureCollection);
    let tile = tileindex.getTile(14, 8192, 8191);
    return vtpbf.fromGeojsonVt({ geojsonLayer: tile });

};

describe("Router Service", () => {
    beforeEach(() => {
        let toastMockCreator = new ToastServiceMockCreator();
        TestBed.configureTestingModule({
            imports: [
                HttpClientModule,
                HttpClientTestingModule,
                MockNgReduxModule
            ],
            providers: [
                { provide: ResourcesService, useValue: toastMockCreator.resourcesService },
                { provide: ToastService, useValue: toastMockCreator.toastService },
                { provide: DatabaseService, usevalue: {} },
                { provide: LoggingService, useValue: { error: () => {} } },
                { provide: RunningContextService, useValue: {} },
                GeoJsonParser,
                RouterService
            ]
        });
        MockNgRedux.reset();
    });

    it("Should route between two points", inject([RouterService, HttpTestingController],
        async (router: RouterService, mockBackend: HttpTestingController) => {
            let promise = router.getRoute({ lat: 1, lng: 1 }, { lat: 2, lng: 2 }, "Hike").then((data) => {
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

    it("Should return start and end points when reponse is not a geojson", inject([RouterService, HttpTestingController],
        async (router: RouterService, mockBackend: HttpTestingController) => {

            let promise = router.getRoute({ lat: 1, lng: 1 }, { lat: 2, lng: 2 }, "Hike").then((data) => {
                expect(data.length).toBe(2);
            }, fail);

            mockBackend.expectOne(() => true).flush({});
            return promise;
        }
    ));

    it("Should return straight route from tiles when getting error response from server and no offline subscription",
        inject([RouterService, HttpTestingController],
        async (router: RouterService, mockBackend: HttpTestingController) => {
            MockNgRedux.store.getState = () => ({
                offlineState: {
                    isOfflineAvailable: false
                }
            });

            let promise = router.getRoute({ lat: 1, lng: 1 }, { lat: 1.001, lng: 1.001 }, "Hike").then((data) => {
                expect(data.length).toBe(2);
            }, fail);

            mockBackend.expectOne(() => true).flush(null, { status: 500, statusText: "Server error" });
            return promise;
        }
    ));

    it("Should return start and end points when getting error response from server and offline is missing",
        inject([RouterService, HttpTestingController],
        async (router: RouterService, mockBackend: HttpTestingController) => {

            MockNgRedux.store.getState = () => ({
                offlineState: {
                    isOfflineAvailable: true,
                    lastModifiedDate: null
                }
            });

            let promise = router.getRoute({ lat: 1, lng: 1 }, { lat: 1.001, lng: 1.001 }, "Hike").then((data) => {
                expect(data.length).toBe(2);
            }, fail);

            mockBackend.expectOne(() => true).flush(null, { status: 500, statusText: "Server error" });
            return promise;
        }
    ));

    it("Should return start and end points when getting error response from server and the points are too far part",
        inject([RouterService, HttpTestingController],
        async (router: RouterService, mockBackend: HttpTestingController) => {

            MockNgRedux.store.getState = () => ({
                offlineState: {
                    isOfflineAvailable: true,
                    lastModifiedDate: new Date()
                }
            });

            let promise = router.getRoute({ lat: 1, lng: 1 }, { lat: 2, lng: 2 }, "Hike").then((data) => {
                expect(data.length).toBe(2);
            }, fail);

            mockBackend.expectOne(() => true).flush(null, { status: 500, statusText: "Server error" });
            return promise;
        }
    ));

    it("Should return a route when getting error response from server and offline is available",
        inject([RouterService, HttpTestingController, DatabaseService],
        async (router: RouterService, mockBackend: HttpTestingController, db: DatabaseService) => {

            let featureCollection = {
                type: "FeatureCollection",
                features: [{
                    type: "Feature",
                    geometry: {
                        type: "LineString",
                        coordinates: [[0.0001,0.0001], [0.0001,0.0002], [0.0001,0.0003]]
                    },
                    properties: {
                        ihm_class: "track"
                    }
                }]
            } as GeoJSON.FeatureCollection;

            db.getTile = () =>  Promise.resolve(createTileFromFeatureCollection(featureCollection));

            MockNgRedux.store.getState = () => ({
                offlineState: {
                    isOfflineAvailable: true,
                    lastModifiedDate: new Date()
                }
            });

            let promise = router.getRoute({ lat: 0.0001, lng: 0.0001 }, { lat: 0.0005, lng: 0.0001 }, "Hike").then((data) => {
                expect(data.length).toBe(3);
            }, fail);

            mockBackend.expectOne(() => true).flush(null, { status: 500, statusText: "Server error" });
            return promise;
        }
    ));

    it("Should return a route when getting error response from server and offline is available for a multiline string",
        inject([RouterService, HttpTestingController, DatabaseService],
        async (router: RouterService, mockBackend: HttpTestingController, db: DatabaseService) => {

            let featureCollection = {
                type: "FeatureCollection",
                features: [{
                    type: "Feature",
                    geometry: {
                        type: "MultiLineString",
                        coordinates: [
                            [[0.0001,0.0001], [0.0001,0.0002], [0.0001,0.0003]],
                            [[0.0001,0.0003], [0.0002,0.0003], [0.0003,0.0003]]
                        ]
                    },
                    properties: {
                        ihm_class: "track"
                    }
                }]
            } as GeoJSON.FeatureCollection;

            db.getTile = () =>  Promise.resolve(createTileFromFeatureCollection(featureCollection));

            MockNgRedux.store.getState = () => ({
                offlineState: {
                    isOfflineAvailable: true,
                    lastModifiedDate: new Date()
                }
            });

            let promise = router.getRoute({ lat: 0.0001, lng: 0.0001 }, { lat: 0.0005, lng: 0.0005 }, "Hike").then((data) => {
                expect(data.length).toBe(5);
            }, fail);

            mockBackend.expectOne(() => true).flush(null, { status: 500, statusText: "Server error" });
            return promise;
        }
    ));

    it("Should return a route when getting error response from server and offline is available only through one line",
        inject([RouterService, HttpTestingController, DatabaseService],
        async (router: RouterService, mockBackend: HttpTestingController, db: DatabaseService) => {

            let featureCollection = {
                type: "FeatureCollection",
                features: [{
                    type: "Feature",
                    geometry: {
                        type: "LineString",
                        coordinates: [[0.0001,0.0001], [0.0001,0.0002], [0.0001,0.0003]]
                    },
                    properties: {
                        ihm_class: "track"
                    }
                }, {
                    type: "Feature",
                    geometry: {
                        type: "LineString",
                        coordinates: [[0.0001,0.0003], [0.0002,0.0003], [0.0003,0.0003]]
                    },
                    properties: {
                        ihm_class: "steps"
                    }
                }]
            } as GeoJSON.FeatureCollection;

            db.getTile = () =>  Promise.resolve(createTileFromFeatureCollection(featureCollection));

            MockNgRedux.store.getState = () => ({
                offlineState: {
                    isOfflineAvailable: true,
                    lastModifiedDate: new Date()
                }
            });

            let promise = router.getRoute({ lat: 0.0001, lng: 0.0001 }, { lat: 0.0005, lng: 0.0005 }, "Bike").then((data) => {
                expect(data.length).toBe(3);
            }, fail);

            mockBackend.expectOne(() => true).flush(null, { status: 500, statusText: "Server error" });
            return promise;
        }
    ));

    it("Should return srart and end point when all lines are filtered out",
        inject([RouterService, HttpTestingController, DatabaseService],
        async (router: RouterService, mockBackend: HttpTestingController, db: DatabaseService) => {

            let featureCollection = {
                type: "FeatureCollection",
                features: [{
                    type: "Feature",
                    geometry: {
                        type: "LineString",
                        coordinates: [[0.0001,0.0003], [0.0002,0.0003], [0.0003,0.0003]]
                    },
                    properties: {
                        ihm_class: "path"
                    }
                }]
            } as GeoJSON.FeatureCollection;

            db.getTile = () =>  Promise.resolve(createTileFromFeatureCollection(featureCollection));

            MockNgRedux.store.getState = () => ({
                offlineState: {
                    isOfflineAvailable: true,
                    lastModifiedDate: new Date()
                }
            });

            let promise = router.getRoute({ lat: 0.0001, lng: 0.0001 }, { lat: 0.0005, lng: 0.0005 }, "4WD").then((data) => {
                expect(data.length).toBe(2);
            }, fail);

            mockBackend.expectOne(() => true).flush(null, { status: 500, statusText: "Server error" });
            return promise;
        }
    ));

    it("Should return a route between two lines when points are not exactly the same",
        inject([RouterService, HttpTestingController, DatabaseService],
        async (router: RouterService, mockBackend: HttpTestingController, db: DatabaseService) => {
            let featureCollection = {
                type: "FeatureCollection",
                features: [{
                    type: "Feature",
                    geometry: {
                        type: "LineString",
                        coordinates: [[0.0001,0.0001], [0.0001,0.0002], [0.0001,0.0003]]
                    },
                    properties: {
                        ihm_class: "major"
                    }
                }, {
                    type: "Feature",
                    geometry: {
                        type: "LineString",
                        coordinates: [[0.0001,0.000305], [0.0002,0.0003], [0.0003,0.0003]]
                    },
                    properties: {
                        ihm_class: "minor"
                    }
                }]
            } as GeoJSON.FeatureCollection;

            db.getTile = () =>  Promise.resolve(createTileFromFeatureCollection(featureCollection));

            MockNgRedux.store.getState = () => ({
                offlineState: {
                    isOfflineAvailable: true,
                    lastModifiedDate: new Date()
                }
            });

            let promise = router.getRoute({ lat: 0.0001, lng: 0.0001 }, { lat: 0.0005, lng: 0.0005 }, "Bike").then((data) => {
                expect(data.length).toBe(5);
            }, fail);

            mockBackend.expectOne(() => true).flush(null, { status: 500, statusText: "Server error" });
            return promise;
        }
    ));
});
