import { TestBed, inject } from "@angular/core/testing";
import { HttpRequest, provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { NgxsModule, Store } from "@ngxs/store";
import { LngLatBounds } from "maplibre-gl";
import { v4 as uuidv4 } from "uuid";

import { ResourcesService } from "./resources.service";
import { WhatsAppService } from "./whatsapp.service";
import { RunningContextService } from "./running-context.service";
import { PoiService } from "./poi.service";
import { HashService, PoiRouteUrlInfo, RouteStrings } from "./hash.service";
import { DatabaseService } from "./database.service";
import { LoggingService } from "./logging.service";
import { FileService } from "./file.service";
import { ToastService } from "./toast.service";
import { MapService } from "./map.service";
import { OverpassTurboService } from "./overpass-turbo.service";
import { INatureService } from "./inature.service";
import { WikidataService } from "./wikidata.service";
import { ImageAttributionService } from "./image-attribution.service";
import { GeoJSONUtils } from "./geojson-utils";
import { GeoJsonParser } from "./geojson.parser";
import { Urls } from "../urls";
import { LayersReducer } from "../reducers/layers.reducer";
import { AddToPoiQueueAction, OfflineReducer } from "../reducers/offline.reducer";
import { ConfigurationReducer, SetLanguageAction } from "../reducers/configuration.reducer";
import type { ApplicationState, LatLngAlt } from "../models";

describe("Poi Service", () => {

    beforeEach(() => {
        const hashService = {
            getFullUrlFromPoiId: (s: PoiRouteUrlInfo) => s.source + "/" + s.id,
        };
        const fileServiceMock = {
            getFileFromCache: () => Promise.resolve(null),
            deleteFileFromCache: () => Promise.resolve()
        };
        const databaseServiceMock = {
            getPoisForClustering: () => Promise.resolve([]),
            addPoiToUploadQueue: () => Promise.resolve(),
            getPoiById: () => Promise.resolve(),
            deletePois: jasmine.createSpy().and.returnValue(Promise.resolve()),
            storePois: jasmine.createSpy().and.returnValue(Promise.resolve()),
            storeImages: jasmine.createSpy().and.returnValue(Promise.resolve())
        } as any;
        const mapServiceMock = {
            map: {
                on: () => { },
                off: () => { },
                getCenter: () => ({ lat: 0, lng: 0 }),
                getZoom: () => 11,
                getBounds: () => new LngLatBounds([1, 1, 2, 2]),
                addSource: () => { },
                addLayer: () => { },
                querySourceFeatures: () => [] as any[]
            },
            initializationPromise: Promise.resolve()
        };
        const loggingService = {
            info: () => { },
            warning: () => { },
            debug: () => { }
        };
        TestBed.configureTestingModule({
            imports: [
                NgxsModule.forRoot([LayersReducer, OfflineReducer, ConfigurationReducer])
            ],
            providers: [
                {
                    provide: ResourcesService, useValue: {
                        getCurrentLanguageCodeSimplified: () => "he"
                    }
                },
                { provide: HashService, useValue: hashService },
                { provide: ToastService, useValue: {} },
                { provide: FileService, useValue: fileServiceMock },
                { provide: DatabaseService, useValue: databaseServiceMock },
                { provide: MapService, useValue: mapServiceMock },
                { provide: LoggingService, useValue: loggingService },
                {
                    provide: OverpassTurboService, useValue: {
                        getLongWay: () => Promise.resolve(null),
                    }
                },
                {
                    provide: INatureService, useValue: {
                        enritchFeatureFromINature: () => Promise.resolve(),
                        createFeatureFromPageId: () => Promise.resolve()
                    }
                },
                {
                    provide: WikidataService, useValue: {
                        enritchFeatureFromWikimedia: () => Promise.resolve(),
                        createFeatureFromPageId: () => Promise.resolve()
                    }
                },
                { provide: ImageAttributionService, useValue: { getAttributionForImage: () => "aaa" } },
                GeoJsonParser,
                RunningContextService,
                WhatsAppService,
                PoiService,
                provideHttpClient(withInterceptorsFromDi()),
                provideHttpClientTesting()
            ]
        });
    });

    it("Should initialize", (inject([PoiService, Store],
        async (poiService: PoiService, store: Store) => {

            store.reset({
                layersState: {},
                offlineState: {
                    uploadPoiQueue: []
                }
            });
            let changed = false;
            poiService.poisChanged.subscribe(() => changed = true);
            const promise = poiService.initialize();

            await promise;

            expect(changed).toBeFalse();
            expect(poiService.poiGeojsonFiltered.features.length).toBe(0);
        }
    )));

    it("Should initialize and show poi tiles, and update when changing language", (inject([PoiService, Store, RunningContextService, MapService],
        async (poiService: PoiService, store: Store, runningContextService: RunningContextService, mapServiceMock: MapService) => {

            store.reset({
                layersState: {
                    visibleCategories: [{ groupType: "Water", name: "Water" }]
                },
                configuration: {},
                offlineState: {
                    uploadPoiQueue: []
                }
            });

            (runningContextService as any).isIFrame = false;
            mapServiceMock.map.on = ((type: string, f: () => void) => { if (type === "moveend") f(); }) as any;
            mapServiceMock.map.querySourceFeatures = () => [
                {
                    id: "11",
                    geometry: {
                        type: "Point",
                        coordinates: [0, 0]
                    },
                    properties: {
                        natural: "spring",
                        "name:he": "name",
                        "name:en": "name"
                    }
                }, {
                    id: "21",
                    geometry: {
                        type: "Point",
                        coordinates: [0, 0]
                    },
                    properties: {
                        natural: "spring",
                        "name:ru": "name"
                    }
                }
            ] as any;
            const promise = poiService.initialize();

            await new Promise((resolve) => setTimeout(resolve, 100)); // this is in order to let the code continue to run to the next await

            expect(poiService.poiGeojsonFiltered.features.length).toBe(1);

            mapServiceMock.map.querySourceFeatures = () => [
                {
                    id: "11",
                    geometry: {
                        type: "Point",
                        coordinates: [0, 0]
                    },
                    properties: {
                        natural: "spring",
                        "name:he": "name",
                        "name:en": "name"
                    }
                },
                {
                    id: "21",
                    geometry: {
                        type: "MultiLineString",
                        coordinates: [[[1, 1], [2, 2]]]
                    },
                    properties: {
                        natural: "spring",
                        "name:he": "name",
                        poiGeolocation: "{\"lat\": 1.1, \"lon\": 1.1 }"
                    }
                }
            ] as any;

            store.dispatch(new SetLanguageAction({ code: "he", rtl: false, label: "עברית" }));

            await new Promise((resolve) => setTimeout(resolve, 100)); // this is in order to let the code continue to run to the next await

            expect(poiService.poiGeojsonFiltered.features.length).toBe(2);
            expect(poiService.poiGeojsonFiltered.features.every(f => f.geometry.type === "Point")).toBeTruthy();
            expect(poiService.poiGeojsonFiltered.features[1].geometry.coordinates).toEqual([1.1, 1.1]);

            return promise;
        }
    )));

    it("Should clear offline queue if feature is not in database", (inject([PoiService, Store, DatabaseService],
        async (poiService: PoiService, store: Store, databaseService: DatabaseService) => {

            store.reset({
                layersState: {},
                configuration: {},
                offlineState: {
                    uploadPoiQueue: ["1"]
                }
            });

            databaseService.getPoiFromUploadQueue = () => Promise.resolve(null);
            const promise = poiService.initialize();

            await new Promise((resolve) => setTimeout(resolve, 100)); // this is in order to let the code continue to run to the next await
            expect(store.selectSnapshot((state: ApplicationState) => state.offlineState).uploadPoiQueue.length).toBe(0);

            return promise;
        }
    )));

    it("Should clear offline queue if feature is in database and not a new feautre", (inject([PoiService, Store, DatabaseService, HttpTestingController],
        async (poiService: PoiService, store: Store, databaseService: DatabaseService, mockBackend: HttpTestingController,) => {

            store.reset({
                layersState: {},
                configuration: {},
                offlineState: {
                    uploadPoiQueue: ["1"]
                }
            });

            databaseService.getPoiFromUploadQueue = () => Promise.resolve({ properties: {} } as GeoJSON.Feature);
            databaseService.removePoiFromUploadQueue = () => Promise.resolve();
            const promise = poiService.initialize();

            await new Promise((resolve) => setTimeout(resolve, 100)); // this is in order to let the code continue to run to the next await

            mockBackend.expectOne(r => r.url.startsWith(Urls.poi)).flush({ properties: {} });

            await new Promise((resolve) => setTimeout(resolve, 100)); // this is in order to let the code continue to run to the next await
            expect(store.selectSnapshot((state: ApplicationState) => state.offlineState).uploadPoiQueue.length).toBe(0);

            return promise;
        }
    )));

    it("Should allow adding a point from private marker for a new point", inject([PoiService, Store], async (poiService: PoiService, store: Store) => {
        const id = uuidv4();
        const markerData = {
            description: "description",
            title: "title",
            type: "some-type",
            urls: [{ mimeType: "image", url: "wikimedia.org/image-url", text: "text" }],
            latlng: { lng: 1, lat: 2 },
            id
        };

        store.reset({
            poiState: {
                uploadMarkerData: markerData
            }
        })

        const feature = await poiService.getBasicInfo("", "new", "he");
        const data = await poiService.createEditableDataAndMerge(feature);
        expect(data.location.lat).toBe(2);
        expect(data.location.lng).toBe(1);
        expect(data.description).toBe("description");
        expect(data.title).toBe("title");
        expect(data.imagesUrls[0]).toBe("wikimedia.org/image-url");
        expect(data.icon).toBe("icon-some-type");
        expect(data.showLocationUpdate).toBeFalsy();
        expect(data.id).toBe(id);
    }));

    it("Should create data for updating a point from private marker by merging it, for an existing point", inject([PoiService, Store], async (poiService: PoiService, store: Store) => {
        const markerData = {
            description: "description",
            title: "title",
            type: "some-type",
            urls: [{ mimeType: "image", url: "wikimedia.org/image-url", text: "text" }],
            latlng: { lng: 1, lat: 2 }
        };

        store.reset({
            poiState: {
                uploadMarkerData: markerData
            }
        })

        const feature: GeoJSON.Feature = {
            type: "Feature",
            geometry: {
                type: "Point",
                coordinates: [3, 4]
            },
            properties: {
                poiId: "poi-42"
            }
        }

        const data = await poiService.createEditableDataAndMerge(structuredClone(feature));
        expect(data.location.lat).toBe(2);
        expect(data.location.lng).toBe(1);
        expect(data.description).toBe("description");
        expect(data.title).toBe("title");
        expect(data.imagesUrls[0]).toBe("wikimedia.org/image-url");
        expect(data.icon).toBe("icon-some-type");
        expect(data.showLocationUpdate).toBeTruthy();
        expect(data.originalFeature).toEqual(feature);
    }));

    it("Should get a point by id and source from the server", (inject([PoiService, HttpTestingController, Store],
        async (poiService: PoiService, mockBackend: HttpTestingController, store: Store) => {
            store.dispatch = jasmine.createSpy();
            const id = "42";
            const source = "source";

            const promise = poiService.getBasicInfo(id, source);

            mockBackend.expectOne((request: HttpRequest<any>) => request.url.includes(id) &&
                request.url.includes(source)).flush({});

            const res = await promise;
            expect(res).not.toBeNull();
            expect(store.dispatch).toHaveBeenCalled();
        }
    )));

    it("Should get a point by id and source from iNature", (inject([PoiService, Store],
        async (poiService: PoiService, store: Store) => {
            store.dispatch = jasmine.createSpy();
            const id = "42";
            const source = "iNature";

            const feature = await poiService.getBasicInfo(id, source);
            expect(feature).not.toBeNull();
            expect(store.dispatch).toHaveBeenCalled();
        }
    )));

    it("Should get a point by id and source from Wikidata", (inject([PoiService, Store],
        async (poiService: PoiService, store: Store) => {
            store.dispatch = jasmine.createSpy();
            const id = "42";
            const source = "Wikidata";

            const feature = await poiService.getBasicInfo(id, source);
            expect(feature).not.toBeNull();
            expect(store.dispatch).toHaveBeenCalled();
        }
    )));

    it("Should get a point by id and source from OSM with iNature and Wikidata", (inject([PoiService, OverpassTurboService],
        async (poiService: PoiService, overpassTurboService: OverpassTurboService) => {

            const id = "way_42";
            const source = "OSM";

            overpassTurboService.getFeature = () => Promise.resolve({
                type: "Feature",
                geometry: {
                    type: "LineString",
                    coordinates: [[35.0415805, 32.4801317], [35.0417149, 32.4801635]]
                },
                properties: {
                    wikidata: "Q42",
                    "mtb:name": "mtb:name",
                    highway: "path",
                    "ref:IL:inature": "42",
                    bicycle: "designated",
                }
            } as GeoJSON.Feature);

            overpassTurboService.getLongWay = () => Promise.resolve({
                type: "Feature",
                geometry: {
                    type: "LineString",
                    coordinates: [[35.0415805, 32.4801317], [35.0417149, 32.4801635], [35.0417149, 32.4801635]]
                },
                properties: {}
            } as GeoJSON.Feature);

            const res = await poiService.getBasicInfo(id, source, "he");
            await poiService.updateExtendedInfo(res, "he");
            expect(res.properties.poiIcon).toBe("icon-bike");
            expect((res.geometry as GeoJSON.LineString).coordinates.length).toBe(3);
        }
    )));

    it("Should get a place point by id and source from OSM with overpass extra data", (inject([PoiService, OverpassTurboService],
        async (poiService: PoiService, overpassTurboService: OverpassTurboService) => {

            const id = "node_42";
            const source = "OSM";

            overpassTurboService.getFeature = () => Promise.resolve({
                type: "Feature",
                geometry: {
                    type: "Point",
                    coordinates: [35.0415805, 32.4801317]
                },
                properties: {
                    place: "village"
                }
            } as GeoJSON.Feature);
            overpassTurboService.getPlaceGeometry = () => Promise.resolve({
                type: "Feature",
                geometry: {
                    type: "LineString",
                    coordinates: [[35.0415805, 32.4801317], [35.0417149, 32.4801635]]
                },
            } as GeoJSON.Feature);
            const res = await poiService.getBasicInfo(id, source, "he");
            await poiService.updateExtendedInfo(res, "he");
            expect(res.properties.poiIcon).toBe("icon-home");
            expect(res.geometry.type).toBe("LineString");
        }
    )));

    it("Should get a point by id and source from the tiles in case the server is not available",
        (inject([PoiService, HttpTestingController, MapService],
            async (poiService: PoiService, mockBackend: HttpTestingController, mapServiceMock: MapService) => {

                const id = "node_42";
                const source = "source";
                const spy = spyOn(mapServiceMock.map, "querySourceFeatures").and.returnValue([{ id: "421", properties: {}, geometry: { type: "Point", coordinates: [0, 0] } } as any]);

                const promise = poiService.getBasicInfo(id, source);

                mockBackend.expectOne((request: HttpRequest<any>) => request.url.includes(id) &&
                    request.url.includes(source)).flush("Some error", { status: 500, statusText: "Time out" });

                const res = await promise;
                expect(res).not.toBeNull();
                expect(spy).toHaveBeenCalled();
            }
        )
        ));

    it("Should not fail on map not initialized when trying to get a point by id and source from the tiles in case the server is not available",
        (inject([PoiService, HttpTestingController, MapService],
            async (poiService: PoiService, mockBackend: HttpTestingController, mapServiceMock: MapService) => {

                const id = "node_42";
                const source = "source";
                mapServiceMock.map = null;

                const promise = poiService.getBasicInfo(id, source);

                mockBackend.expectOne((request: HttpRequest<any>) => request.url.includes(id) &&
                    request.url.includes(source)).flush("Some error", { status: 500, statusText: "Time out" });

                await expectAsync(promise).toBeRejectedWithError(/Failed to load POI .* from offline or in-memory tiles after .*/)
            }
        )
        ));

    it("Should throw when trying to get a point by id and source and it is not available in the server and in the tiles",
        (inject([PoiService, HttpTestingController, MapService],
            async (poiService: PoiService, mockBackend: HttpTestingController, mapServiceMock: MapService) => {

                const id = "42";
                const source = "source";
                const spy = spyOn(mapServiceMock.map, "querySourceFeatures").and.returnValue([]);

                const promise = poiService.getBasicInfo(id, source);


                mockBackend.expectOne((request: HttpRequest<any>) => request.url.includes(id) &&
                    request.url.includes(source)).flush("Some error", { status: 500, statusText: "Time out" });

                await expectAsync(promise).toBeRejected();
                expect(spy).toHaveBeenCalled();
            }
        )
        ));

    it("Should get a point by id and source from the cache after the first load", (inject([PoiService, HttpTestingController],
        async (poiService: PoiService, mockBackend: HttpTestingController) => {

            const id = "42";
            const source = "source";

            const promise = poiService.getBasicInfo(id, source);

            mockBackend.expectOne((request: HttpRequest<any>) => request.url.includes(id) &&
                request.url.includes(source)).flush({
                    properties: {
                        poiId: id,
                        source
                    }
                });

            const res = await promise;
            expect(res).not.toBeNull();
            const res2 = await poiService.getBasicInfo(id, source);
            expect(res2).not.toBeNull();
        }
    )));

    it("Should get coordinates basic info", inject([PoiService, Store], async (service: PoiService, store: Store) => {
        store.dispatch = jasmine.createSpy();

        const coordinatesFeature = await service.getBasicInfo("1_2", RouteStrings.COORDINATES, "he");

        expect(coordinatesFeature.geometry.type).toBe("Point");
        expect((coordinatesFeature.geometry as GeoJSON.Point).coordinates).toEqual([2, 1]);
        expect(store.dispatch).toHaveBeenCalled();
    }));

    it("Should create simple point",
        inject([PoiService, Store],
            async (poiService: PoiService, store: Store) => {
                const spy = jasmine.createSpy();
                store.dispatch = spy;
                await poiService.addSimplePoint({ lat: 0, lng: 0 }, "Tap", "id");

                expect(store.dispatch).toHaveBeenCalled();
                expect(spy.calls.first().args[0]).toBeInstanceOf(AddToPoiQueueAction);
            }
        )
    );

    it("Should create complex point",
        inject([PoiService, DatabaseService, Store],
            async (poiService: PoiService, dbMock: DatabaseService, store: Store) => {
                const spy = spyOn(dbMock, "addPoiToUploadQueue");
                store.dispatch = jasmine.createSpy();
                await poiService.addComplexPoi({
                    id: "poiId",
                    isPoint: true,
                    category: "natural",
                    icon: "icon-spring",
                    iconColor: "#1e80e3",
                    description: "description",
                    imagesUrls: ["some-image-url"],
                    title: "title",
                    urls: ["some-url"],
                    canEditTitle: true,
                    originalFeature: null,
                    showLocationUpdate: false,
                    location: { lat: 0, lng: 0 } as LatLngAlt
                });

                expect(store.dispatch).toHaveBeenCalled();
                expect(spy.calls.mostRecent().args[0].properties.poiId).not.toBeNull();
                expect(spy.calls.mostRecent().args[0].properties.poiSource).toBe("OSM");
                expect(spy.calls.mostRecent().args[0].properties["description:he"]).toBe("description");
                expect(spy.calls.mostRecent().args[0].properties["name:he"]).toBe("title");
                expect(spy.calls.mostRecent().args[0].properties.website).toBe("some-url");
                expect(spy.calls.mostRecent().args[0].properties.image).toBe("some-image-url");
                expect(spy.calls.mostRecent().args[0].geometry.type).toBe("Point");
            }
        )
    );

    it("Should update complex point given a point with no description",
        inject([PoiService, DatabaseService, Store],
            async (poiService: PoiService, dbMock: DatabaseService, store: Store) => {
                store.reset({
                    offlineState: {
                        uploadPoiQueue: [] as any[]
                    }
                });
                store.dispatch = jasmine.createSpy();
                const spy = spyOn(dbMock, "addPoiToUploadQueue");
                await poiService.updateComplexPoi({
                    id: "poiId",
                    isPoint: true,
                    category: "natural",
                    icon: "icon-spring",
                    iconColor: "#1e80e3",
                    description: "description",
                    imagesUrls: ["some-new-image-url"],
                    title: "title",
                    urls: ["some-new-url"],
                    canEditTitle: true,
                    showLocationUpdate: true,
                    location: { lat: 1, lng: 2 } as LatLngAlt,
                    originalFeature: {
                        properties: {
                            poiSource: "OSM",
                            poiId: "poiId",
                            identifier: "id",
                            imageUrl: "wikimedia.org/some-old-image-url",
                            website: "some-old-url"
                        } as any,
                        geometry: {
                            type: "Point",
                            coordinates: [0, 0]
                        }
                    } as GeoJSON.Feature
                }, true);

                expect(store.dispatch).toHaveBeenCalled();
                const feature = spy.calls.mostRecent().args[0];
                expect(feature.properties.poiId).not.toBeNull();
                expect(feature.properties.poiSource).toBe("OSM");
                expect(feature.properties["description:he"]).toBe("description");
                expect(GeoJSONUtils.getDescription(feature, "he")).toBe("description");
                expect(feature.properties["name:he"]).toBe("title");
                expect(GeoJSONUtils.getTitle(feature, "he")).toBe("title");
                expect(feature.properties.poiAddedUrls).toEqual(["some-new-url"]);
                expect(feature.properties.poiRemovedUrls).toEqual(["some-old-url"]);
                expect(feature.properties.poiAddedImages).toEqual(["some-new-image-url"]);
                expect(feature.properties.poiRemovedImages).toEqual(["wikimedia.org/some-old-image-url"]);
                expect(feature.properties.poiIcon).toBe("icon-spring");
                expect(feature.properties.poiGeolocation.lat).toBe(1);
                expect(feature.properties.poiGeolocation.lon).toBe(2);
                expect(GeoJSONUtils.getLocation(feature).lat).toBe(1);
                expect(GeoJSONUtils.getLocation(feature).lng).toBe(2);
                // expected to not change geometry
                expect(feature.geometry.type).toBe("Point");
                expect((feature.geometry as GeoJSON.Point).coordinates).toEqual([0, 0]);
            }
        )
    );

    it("Should not update complex point when there were no changes",
        inject([PoiService, DatabaseService, Store],
            async (poiService: PoiService, dbMock: DatabaseService, store: Store) => {
                store.reset({
                    offlineState: {
                        uploadPoiQueue: [] as any[]
                    }
                });
                const spy = spyOn(dbMock, "addPoiToUploadQueue");
                await poiService.updateComplexPoi({
                    id: "poiId",
                    isPoint: true,
                    category: "natural",
                    icon: "icon-spring",
                    iconColor: "#1e80e3",
                    description: "description",
                    imagesUrls: ["wikimedia.org/some-image-url"],
                    title: "title",
                    urls: ["some-url"],
                    canEditTitle: true,
                    showLocationUpdate: false,
                    location: { lat: 0, lng: 0 } as LatLngAlt,
                    originalFeature: {
                        properties: {
                            poiSource: "OSM",
                            poiId: "poiId",
                            identifier: "id",
                            imageUrl: "wikimedia.org/some-image-url",
                            website: "some-url",
                            description: "description",
                            poiCategory: "natural",
                            poiIcon: "icon-spring",
                            poiIconColor: "#1e80e3",
                            name: "title",
                        } as any,
                        geometry: {
                            type: "Point",
                            coordinates: [0, 0]
                        }
                    } as GeoJSON.Feature
                }, false);

                expect(spy).not.toHaveBeenCalled();
            }
        )
    );

    it("Should add properties when update point is in the queue already",
        inject([PoiService, DatabaseService, Store],
            async (poiService: PoiService, dbMock: DatabaseService, store: Store) => {
                const featureInQueue = {
                    properties: {
                        poiSource: "OSM",
                        poiId: "poiId",
                        identifier: "id"
                    } as any,
                    geometry: {
                        type: "Point",
                        coordinates: [0, 0]
                    }
                } as GeoJSON.Feature;
                GeoJSONUtils.setLocation(featureInQueue, { lat: 1, lng: 2 });
                dbMock.getPoiFromUploadQueue = () => Promise.resolve(featureInQueue);
                store.reset({
                    offlineState: {
                        uploadPoiQueue: ["poiId"]
                    }
                });
                store.dispatch = jasmine.createSpy();
                const spy = spyOn(dbMock, "addPoiToUploadQueue");
                await poiService.updateComplexPoi({
                    id: "poiId",
                    isPoint: true,
                    category: "natural",
                    icon: "icon-spring",
                    iconColor: "#1e80e3",
                    description: "description",
                    imagesUrls: ["some-image-url"],
                    title: "title",
                    urls: ["some-url"],
                    canEditTitle: true,
                    showLocationUpdate: false,
                    location: { lat: 0, lng: 0 } as LatLngAlt,
                    originalFeature: {
                        properties: {
                            poiSource: "OSM",
                            poiId: "poiId",
                            identifier: "id",
                            poiIcon: "icon-spring",
                            poiIconColor: "#1e80e3",
                        } as any,
                        geometry: {
                            type: "Point",
                            coordinates: [0, 0]
                        }
                    } as GeoJSON.Feature
                }, false);

                expect(store.dispatch).toHaveBeenCalled();
                const feature = spy.calls.mostRecent().args[0];
                expect(feature.properties.poiId).not.toBeNull();
                expect(feature.properties.poiSource).toBe("OSM");
                expect(feature.properties["description:he"]).toBe("description");
                expect(GeoJSONUtils.getDescription(feature, "he")).toBe("description");
                expect(feature.properties["name:he"]).toBe("title");
                expect(GeoJSONUtils.getTitle(feature, "he")).toBe("title");
                expect(feature.properties.poiAddedUrls).toEqual(["some-url"]);
                expect(feature.properties.poiAddedImages).toEqual(["some-image-url"]);
                expect(feature.properties.poiIcon).toBeUndefined();
                expect(feature.properties.poiGeolocation.lat).toBe(1);
                expect(feature.properties.poiGeolocation.lon).toBe(2);
                expect(GeoJSONUtils.getLocation(feature).lat).toBe(1);
                expect(GeoJSONUtils.getLocation(feature).lng).toBe(2);
                // expected to not change geometry
                expect(feature.geometry.type).toBe("Point");
                expect((feature.geometry as GeoJSON.Point).coordinates).toEqual([0, 0]);
            }
        )
    );

    it("Should get null length in Km for point", inject([PoiService], async (poiService: PoiService) => {
        const feature = {
            properties: {
                poiSource: "OSM",
                poiId: "poiId",
                identifier: "id",
                image: "invalid-image-url",
            } as any,
            geometry: {
                type: "Point",
                coordinates: [1, 2]
            }
        } as GeoJSON.Feature;
        const length = await poiService.getLengthInKm(feature);
        expect(length).toBeNull();
    }));

    it("Should get length in Km for line", inject([PoiService], async (poiService: PoiService) => {
        const feature = {
            properties: {
                poiSource: "OSM",
                poiId: "poiId",
                identifier: "id",
                image: "invalid-image-url",
            } as any,
            geometry: {
                type: "LineString",
                coordinates: [[1, 2], [3, 4]]
            }
        } as GeoJSON.Feature;
        const length = await poiService.getLengthInKm(feature);
        expect(length).toBeGreaterThan(0);
    }));

    it("Should filter out incompatible images",
        inject([PoiService, Store], async (poiService: PoiService, store: Store) => {
            const feature = {
                properties: {
                    poiSource: "OSM",
                    poiId: "poiId",
                    identifier: "id",
                    image: "invalid-image-url",
                } as any,
                geometry: {
                    type: "Point",
                    coordinates: [1, 2]
                }
            } as GeoJSON.Feature;
            store.reset({
                poiState: {
                    uploadMarkerData: null
                }
            });
            const info = await poiService.createEditableDataAndMerge(feature);
            expect(info.imagesUrls.length).toBe(0);
        }
        )
    );

    it("Should filter out invalid wikipedia images",
        inject([PoiService, Store], async (poiService: PoiService, store: Store) => {
            const feature = {
                properties: {
                    poiSource: "OSM",
                    poiId: "poiId",
                    identifier: "id",
                    image: "https://upload.wikimedia.org/wikipedia/commons/b/b6/Building_no_free_image_yet-he.png",
                    image1: "https://upload.wikimedia.org/wikipedia/commons/b/b6/1.svg",
                    image2: "https://upload.wikimedia.org/wikipedia/commons/b/b6/2.svg.png",
                } as any,
                geometry: {
                    type: "Point",
                    coordinates: [1, 2]
                }
            } as GeoJSON.Feature;
            store.reset({
                poiState: {
                    uploadMarkerData: null
                }
            });
            const info = await poiService.createEditableDataAndMerge(feature);
            expect(info.imagesUrls.length).toBe(0);
        }
        )
    );

    it("Should filter out images with no attribution",
        inject([PoiService, ImageAttributionService], async (poiService: PoiService, attributionService: ImageAttributionService) => {
            const feature = {
                properties: {
                    poiSource: "OSM",
                    poiId: "poiId",
                    identifier: "id",
                    image: "wikimedia.org/image-url",
                    image1: "wikimedia.org/image-url1",
                    image2: "wikimedia.org/image-url2",
                } as any,
                geometry: {
                    type: "Point",
                    coordinates: [1, 2]
                }
            } as GeoJSON.Feature;
            spyOn(attributionService, "getAttributionForImage").and.returnValues(Promise.resolve(null), Promise.resolve("aaa") as any, Promise.resolve(null));

            const imagesUrls = await poiService.getImagesThatHaveAttribution(feature);
            expect(imagesUrls.length).toBe(1);
            expect(imagesUrls[0]).toBe("wikimedia.org/image-url1");
        }
        )
    );

    it("should get closest point from server", (inject([PoiService, HttpTestingController],
        async (poiService: PoiService, mockBackend: HttpTestingController) => {

            const promise = poiService.getClosestPoint({ lat: 0, lng: 0 }, "", "");

            mockBackend.expectOne((request: HttpRequest<any>) => request.url.includes(Urls.poiClosest))
                .flush({
                    type: "Feature",
                    properties: { "name:he": "name" },
                    geometry: { type: "Point", coordinates: [1, 1] },
                } as GeoJSON.Feature);

            const data = await promise;
            expect(data.latlng.lat).toBe(1);
            expect(data.latlng.lng).toBe(1);
        })
    ));

    it("should not get closest point from server when there's a server error", (inject([PoiService, HttpTestingController],
        async (poiService: PoiService, mockBackend: HttpTestingController) => {

            const promise = poiService.getClosestPoint({ lat: 0, lng: 0 }, "", "");

            mockBackend.expectOne((request: HttpRequest<any>) => request.url.includes(Urls.poiClosest))
                .flush("Invalid", { status: 400, statusText: "Bad Request" });

            const data = await promise;
            expect(data).toBeNull();
        })
    ));

    it("should return the itm coordinates for feature", inject([PoiService], (poiService: PoiService) => {
        const results = poiService.getItmCoordinates({ properties: { poiItmEast: 1, poiItmNorth: 2 } } as any as GeoJSON.Feature);
        expect(results.east).toBe(1);
        expect(results.north).toBe(2);
    }));

    it("should get social links", inject([PoiService], (poiService: PoiService) => {
        const results = poiService.getFeatureFromCoordinatesId("1_2", "he");
        expect((results.geometry as GeoJSON.Point).coordinates).toEqual([2, 1]);
    }));

    it("Should get social links", inject([PoiService], (poiService: PoiService) => {
        const results = poiService.getPoiSocialLinks({
            type: "Feature",
            properties: {
                poiSource: "OSM",
                identifier: "way_42",
                poiGeolocation: {
                    lat: 1,
                    lon: 2
                }
            },
            geometry: {
                type: "Point",
                coordinates: [0, 0]
            }
        });
        expect(results.poiLink).toBe("OSM/way_42");
        expect(results.facebook).toContain(Urls.facebook);
        expect(results.waze).toBe(Urls.waze + "1,2");
        expect(results.whatsapp).toContain("OSM");
    }));
});
