import { TestBed, inject, fakeAsync, tick, discardPeriodicTasks } from "@angular/core/testing";
import { HttpClientModule, HttpRequest } from "@angular/common/http";
import { HttpClientTestingModule, HttpTestingController } from "@angular/common/http/testing";
import { MockNgRedux, MockNgReduxModule } from "@angular-redux2/store/testing";

import { ToastServiceMockCreator } from "./toast.service.spec";
import { ResourcesService } from "./resources.service";
import { WhatsAppService } from "./whatsapp.service";
import { RunningContextService } from "./running-context.service";
import { PoiService } from "./poi.service";
import { HashService } from "./hash.service";
import { DatabaseService } from "./database.service";
import { LoggingService } from "./logging.service";
import { FileService } from "./file.service";
import { ToastService } from "./toast.service";
import { MapService } from "./map.service";
import { GeoJsonParser } from "./geojson.parser";
import { Urls } from "../urls";
import type { ApplicationState, Category, MarkerData } from "../models/models";
import JSZip from "jszip";

describe("Poi Service", () => {

    beforeEach(() => {
        let toastMock = new ToastServiceMockCreator();
        let hashService = {
            getFullUrlFromPoiId: () => {}
        };
        let fileServiceMock = {
            getFileFromCache: () => Promise.resolve(null),
            deleteFileFromCache: () => Promise.resolve(),
            downloadFileToCache: () => Promise.resolve()
        };
        let databaseServiceMock = {
            getPoisForClustering: () => Promise.resolve([]),
            addPoiToUploadQueue: () => Promise.resolve(),
            getPoiById: () => Promise.resolve(),
            deletePois: jasmine.createSpy().and.returnValue(Promise.resolve()),
            storePois: jasmine.createSpy().and.returnValue(Promise.resolve()),
            storeImages: jasmine.createSpy().and.returnValue(Promise.resolve())
        } as any;
        let mapServiceMosk = {
            map: {
                on: () => { },
                off: () => { },
                getCenter: () => ({ lat: 0, lng: 0})
            }
        };
        let loggingService = {
            info: () => {},
            warning: () => {},
            debug: () => {}
        };
        TestBed.configureTestingModule({
            imports: [
                HttpClientModule,
                HttpClientTestingModule,
                MockNgReduxModule
            ],
            providers: [
                { provide: ResourcesService, useValue: toastMock.resourcesService },
                { provide: HashService, useValue: hashService },
                { provide: ToastService, useValue: toastMock.toastService },
                { provide: FileService, useValue: fileServiceMock },
                { provide: DatabaseService, useValue: databaseServiceMock },
                { provide: MapService, useValue: mapServiceMosk },
                { provide: LoggingService, useValue: loggingService },
                GeoJsonParser,
                RunningContextService,
                WhatsAppService,
                PoiService
            ]
        });
        MockNgRedux.reset();
        MockNgRedux.store.dispatch = jasmine.createSpy();
    });

    it("Should initialize and sync categories from server", (inject([PoiService, HttpTestingController],
        async (poiService: PoiService, mockBackend: HttpTestingController) => {

            MockNgRedux.store.getState = () => ({
                layersState: {
                    categoriesGroups: [{ type: "type", categories: [] as any[], visible: true }]
                }
            });
            let changed = false;
            poiService.poisChanged.subscribe(() => changed = true);
            let promise = poiService.initialize();
            mockBackend.match(r => r.url.startsWith(Urls.poiCategories)).forEach(t => t.flush([{ icon: "icon", name: "category" }]));
            await new Promise((resolve) => setTimeout(resolve, 100)); // this is in order to let the code continue to run to the next await

            await promise;

            expect(changed).toBe(true);
            expect(poiService.poiGeojsonFiltered.features.length).toBe(0);
        }
    )));

    it("Should initialize and download offline pois file",
        (inject([PoiService, HttpTestingController, RunningContextService, FileService, DatabaseService],
            async (poiService: PoiService, mockBackend: HttpTestingController, runningContextService: RunningContextService,
                fileService: FileService, databaseService: DatabaseService) => {

                MockNgRedux.store.getState = () => ({
                    layersState: {
                        categoriesGroups: [{ type: "type", categories: [] as any[], visible: true }]
                    },
                    offlineState: {
                        poisLastModifiedDate: null
                    }
                });
                (runningContextService as any).isCapacitor = true;
                let zip = new JSZip();
                zip.folder("pois");
                zip.file("pois/001.geojson", JSON.stringify({ features: [{
                    type: "Feature",
                    properties: { poiLastModified: new Date("2022-02-22") }
                }] }));
                zip.folder("images");
                zip.file("images/001.json", JSON.stringify([{imageUrls: [{imageUrl: "img", thumbnail: "some-data"}]}]));
                let zipOutputPromise = zip.generateAsync({type: "blob"});
                let getFileFromcacheSpy = spyOn(fileService, "getFileFromCache").and.returnValues(Promise.resolve(null), zipOutputPromise);

                let promise = poiService.initialize().then(() => {
                    expect(poiService.poiGeojsonFiltered.features.length).toBe(0);
                    expect(getFileFromcacheSpy).toHaveBeenCalledTimes(2);
                    expect(databaseService.storePois).toHaveBeenCalled();
                    expect(databaseService.storeImages).toHaveBeenCalled();
                    expect(MockNgRedux.store.dispatch).toHaveBeenCalled();
                });
                mockBackend.match(r => r.url.startsWith(Urls.poiCategories)).forEach(t => t.flush([{ icon: "icon", name: "category" }]));

                return promise;
            }
        ))
    );

    it("Should initialize and update pois by pagination",
        fakeAsync(inject([PoiService, HttpTestingController, RunningContextService, DatabaseService],
            (poiService: PoiService, mockBackend: HttpTestingController,
                runningContextService: RunningContextService, databaseService: DatabaseService) => {

                MockNgRedux.store.getState = () => ({
                    layersState: {
                        categoriesGroups: [{ type: "type", categories: [] as any[], visible: true }]
                    },
                    offlineState: {
                        poisLastModifiedDate: Date.now()
                    }
                });
                (runningContextService as any).isCapacitor = true;
                poiService.initialize().then(() => {
                    expect(poiService.poiGeojsonFiltered.features.length).toBe(0);
                    expect(databaseService.storePois).toHaveBeenCalled();
                    expect(databaseService.storeImages).toHaveBeenCalled();
                    expect(databaseService.deletePois).toHaveBeenCalled();
                });
                mockBackend.match(r => r.url.startsWith(Urls.poiCategories)).forEach(t => t.flush([{ icon: "icon", name: "category" }]));
                tick();
                mockBackend.expectOne(r => r.url.startsWith(Urls.poiUpdates)).flush({
                    features: [{
                        type: "Feature",
                        properties: { poiDeleted: true, poiId: "1"}
                    }],
                    images: [],
                    lastModified: Date.now()
                });
                discardPeriodicTasks();
            }
        ))
    );

    it("Should get selectable categories", (inject([PoiService, HttpTestingController],
        (poiService: PoiService) => {
            MockNgRedux.store.getState = () => ({
                layersState: {
                    categoriesGroups: [{type: "Points of Interest", categories: [
                        {name: "iNature", items: []},
                        {name: "Wikipedia", items: []},
                        {name: "Water", items: [
                            {iconColorCategory: { icon: "icon-nature-reserve"}},
                            {iconColorCategory: { icon: "other-icon"}}
                        ]}
                    ]}]
                }
            });

            let categories = poiService.getSelectableCategories();

            expect(categories.length).toBe(1);
            expect(categories[0].icons.length).toBe(1);
        }
    )));

    it("Should get a point by id and source from the server", (inject([PoiService, HttpTestingController],
        async (poiService: PoiService, mockBackend: HttpTestingController) => {

            let id = "42";
            let source = "source";

            let promise = poiService.getPoint(id, source).then((res) => {
                expect(res).not.toBeNull();
            });

            mockBackend.expectOne((request: HttpRequest<any>) => request.url.includes(id) &&
                    request.url.includes(source)).flush({});
            return promise;
        }
    )));

    it("Should get a point by id and source from the database in case the server is not available",
        (inject([PoiService, HttpTestingController, DatabaseService],
            async (poiService: PoiService, mockBackend: HttpTestingController, dbMock: DatabaseService) => {

                let id = "42";
                let source = "source";
                let spy = spyOn(dbMock, "getPoiById").and.returnValue(Promise.resolve({} as any));

                let promise = poiService.getPoint(id, source).then((res) => {
                    expect(res).not.toBeNull();
                    expect(spy).toHaveBeenCalled();
                });

                mockBackend.expectOne((request: HttpRequest<any>) => request.url.includes(id) &&
                        request.url.includes(source)).flush("Some error", { status: 500, statusText: "Time out"});
                return promise;
            }
        )
    ));

    it("Should throw when trying to get a point by id and source and it is not available in the server and in the database",
        (inject([PoiService, HttpTestingController, DatabaseService],
            async (poiService: PoiService, mockBackend: HttpTestingController, dbMock: DatabaseService) => {

                let id = "42";
                let source = "source";
                let spy = spyOn(dbMock, "getPoiById");

                let promise = new Promise((resolve, reject) => {
                    poiService.getPoint(id, source).then(reject, (err) => {
                        expect(spy).toHaveBeenCalled();
                        expect(err).not.toBeNull();
                        resolve(null);
                    });
                });

                mockBackend.expectOne((request: HttpRequest<any>) => request.url.includes(id) &&
                        request.url.includes(source)).flush("Some error", { status: 500, statusText: "Time out"});
                return promise;
            }
        )
    ));

    it("Should get a point by id and source from the cache after the first load", (inject([PoiService, HttpTestingController],
        async (poiService: PoiService, mockBackend: HttpTestingController) => {

            let id = "42";
            let source = "source";

            let promise = new Promise((resolve, reject) => {
                poiService.getPoint(id, source).then((res) => {
                    expect(res).not.toBeNull();
                    poiService.getPoint(id, source).then((res2) => {
                        expect(res2).not.toBeNull();
                        resolve(null);
                    }, reject);
                }, reject);
            });

            mockBackend.expectOne((request: HttpRequest<any>) => request.url.includes(id) &&
                    request.url.includes(source)).flush({
                        properties: {
                            poiId: id,
                            source
                        }
                    });
            return promise;
        }
    )));


    it("Should create simple point",
        inject([PoiService],
            async (poiService: PoiService) => {
                let promise = poiService.addSimplePoint({ lat: 0, lng: 0}, "Tap").then(() => {
                    expect(MockNgRedux.store.dispatch).toHaveBeenCalled();
                });

                return promise;
            }
        )
    );

    it("Should create complex point",
        inject([PoiService, DatabaseService],
            async (poiService: PoiService, dbMock: DatabaseService) => {
                let spy = spyOn(dbMock, "addPoiToUploadQueue");
                let promise = poiService.addComplexPoi({
                    id: "poiId",
                    isPoint: true,
                    category: "natural",
                    icon: "icon-spring",
                    iconColor: "blue",
                    description: "description",
                    imagesUrls: ["some-image-url"],
                    title: "title",
                    urls: ["some-url"],
                    canEditTitle: true
                }, { lat: 0, lng: 0}).then(() => {
                    expect(MockNgRedux.store.dispatch).toHaveBeenCalled();
                    expect(spy.calls.mostRecent().args[0].properties.poiId).not.toBeNull();
                    expect(spy.calls.mostRecent().args[0].properties.poiSource).toBe("OSM");
                    expect(spy.calls.mostRecent().args[0].properties["description:he"]).toBe("description");
                    expect(spy.calls.mostRecent().args[0].properties["name:he"]).toBe("title");
                    expect(spy.calls.mostRecent().args[0].properties.website).toBe("some-url");
                    expect(spy.calls.mostRecent().args[0].properties.image).toBe("some-image-url");
                    expect(spy.calls.mostRecent().args[0].geometry.type).toBe("Point");
                });

                return promise;
            }
        )
    );

    it("Should update complex point given a point with no description",
        inject([PoiService, DatabaseService],
            async (poiService: PoiService, dbMock: DatabaseService) => {
                MockNgRedux.store.getState = () => ({
                        poiState: {
                            selectedPointOfInterest: {
                                properties: {
                                    poiSource: "OSM",
                                    poiId: "poiId",
                                    identifier: "id",
                                    imageUrl: "some-old-image-url",
                                    website: "some-old-url"
                                } as any,
                                geometry: {
                                    type: "Point",
                                    coordinates: [0, 0]
                                }
                            } as GeoJSON.Feature
                        },
                        offlineState: {
                            uploadPoiQueue: [] as any[]
                        }
                    });
                let spy = spyOn(dbMock, "addPoiToUploadQueue");
                let promise = poiService.updateComplexPoi({
                    id: "poiId",
                    isPoint: true,
                    category: "natural",
                    icon: "icon-spring",
                    iconColor: "blue",
                    description: "description",
                    imagesUrls: ["some-new-image-url"],
                    title: "title",
                    urls: ["some-new-url"],
                    canEditTitle: true
                }, { lat: 1, lng: 2}).then(() => {
                    expect(MockNgRedux.store.dispatch).toHaveBeenCalled();
                    let feature = spy.calls.mostRecent().args[0];
                    expect(feature.properties.poiId).not.toBeNull();
                    expect(feature.properties.poiSource).toBe("OSM");
                    expect(feature.properties["description:he"]).toBe("description");
                    expect(poiService.getDescription(feature, "he")).toBe("description");
                    expect(feature.properties["name:he"]).toBe("title");
                    expect(poiService.getTitle(feature, "he")).toBe("title");
                    expect(feature.properties.poiAddedUrls).toEqual(["some-new-url"]);
                    expect(feature.properties.poiRemovedUrls).toEqual(["some-old-url"]);
                    expect(feature.properties.poiAddedImages).toEqual(["some-new-image-url"]);
                    expect(feature.properties.poiRemovedImages).toEqual(["some-old-image-url"]);
                    expect(feature.properties.poiIcon).toBe("icon-spring");
                    expect(feature.properties.poiGeolocation.lat).toBe(1);
                    expect(feature.properties.poiGeolocation.lon).toBe(2);
                    expect(poiService.getLocation(feature).lat).toBe(1);
                    expect(poiService.getLocation(feature).lng).toBe(2);
                    // expected to not change geometry
                    expect(feature.geometry.type).toBe("Point");
                    expect((feature.geometry as GeoJSON.Point).coordinates).toEqual([0, 0]);
                });

                return promise;
            }
        )
    );

    it("Should not update complex point when there were no changes",
        inject([PoiService, DatabaseService],
            async (poiService: PoiService, dbMock: DatabaseService) => {
                MockNgRedux.store.getState = () => ({
                        poiState: {
                            selectedPointOfInterest: {
                                properties: {
                                    poiSource: "OSM",
                                    poiId: "poiId",
                                    identifier: "id",
                                    imageUrl: "some-image-url",
                                    website: "some-url",
                                    description: "description",
                                    poiCategory: "natural",
                                    poiIcon: "icon-spring",
                                    poiIconColor: "blue",
                                    name: "title",
                                } as any,
                                geometry: {
                                    type: "Point",
                                    coordinates: [0, 0]
                                }
                            } as GeoJSON.Feature
                        },
                        offlineState: {
                            uploadPoiQueue: [] as any[]
                        }
                    });
                let spy = spyOn(dbMock, "addPoiToUploadQueue");
                let promise = poiService.updateComplexPoi({
                    id: "poiId",
                    isPoint: true,
                    category: "natural",
                    icon: "icon-spring",
                    iconColor: "blue",
                    description: "description",
                    imagesUrls: ["some-image-url"],
                    title: "title",
                    urls: ["some-url"],
                    canEditTitle: true
                }).then(() => {
                    expect(spy).not.toHaveBeenCalled();
                });

                return promise;
            }
        )
    );

    it("Should add properties when update point is in the queue already",
        inject([PoiService, DatabaseService],
            async (poiService: PoiService, dbMock: DatabaseService) => {
                let featureInQueue = {
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
                poiService.setLocation(featureInQueue, { lat: 1, lng: 2 });
                dbMock.getPoiFromUploadQueue = () => Promise.resolve(featureInQueue);
                MockNgRedux.store.getState = () => ({
                        poiState: {
                            selectedPointOfInterest: {
                                properties: {
                                    poiSource: "OSM",
                                    poiId: "poiId",
                                    identifier: "id",
                                    poiIcon: "icon-spring",
                                    poiIconColor: "blue",
                                } as any,
                                geometry: {
                                    type: "Point",
                                    coordinates: [0, 0]
                                }
                            } as GeoJSON.Feature
                        },
                        offlineState: {
                            uploadPoiQueue: ["poiId"]
                        }
                    } as ApplicationState);
                let spy = spyOn(dbMock, "addPoiToUploadQueue");
                let promise = poiService.updateComplexPoi({
                    id: "poiId",
                    isPoint: true,
                    category: "natural",
                    icon: "icon-spring",
                    iconColor: "blue",
                    description: "description",
                    imagesUrls: ["some-image-url"],
                    title: "title",
                    urls: ["some-url"],
                    canEditTitle: true
                }).then(() => {
                    expect(MockNgRedux.store.dispatch).toHaveBeenCalled();
                    let feature = spy.calls.mostRecent().args[0];
                    expect(feature.properties.poiId).not.toBeNull();
                    expect(feature.properties.poiSource).toBe("OSM");
                    expect(feature.properties["description:he"]).toBe("description");
                    expect(poiService.getDescription(feature, "he")).toBe("description");
                    expect(feature.properties["name:he"]).toBe("title");
                    expect(poiService.getTitle(feature, "he")).toBe("title");
                    expect(feature.properties.poiAddedUrls).toEqual(["some-url"]);
                    expect(feature.properties.poiAddedImages).toEqual(["some-image-url"]);
                    expect(feature.properties.poiIcon).toBeUndefined();
                    expect(feature.properties.poiGeolocation.lat).toBe(1);
                    expect(feature.properties.poiGeolocation.lon).toBe(2);
                    expect(poiService.getLocation(feature).lat).toBe(1);
                    expect(poiService.getLocation(feature).lng).toBe(2);
                    // expected to not change geometry
                    expect(feature.geometry.type).toBe("Point");
                    expect((feature.geometry as GeoJSON.Point).coordinates).toEqual([0, 0]);
                });

                return promise;
            }
        )
    );

    it("Should allow adding a point from private marker",
        inject([PoiService], (poiService: PoiService) => {
                let feature = {
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

                let markerData = {
                    description: "description",
                    title: "title",
                    type: "some-type",
                    urls: [{mimeType: "image", url: "image-url", text: "text"}],
                    latlng: { lng: 1, lat: 2}
                };

                poiService.mergeWithPoi(feature, markerData);
                let info = poiService.getEditableDataFromFeature(feature);
                let featureAfterConverstion = poiService.getFeatureFromEditableData(info);
                poiService.setLocation(featureAfterConverstion, { lat: 2, lng: 1});
                expect(poiService.getLocation(featureAfterConverstion).lat).toBe(2);
                expect(poiService.getLocation(featureAfterConverstion).lng).toBe(1);
                expect(poiService.getDescription(featureAfterConverstion, "he")).toBe("description");
                expect(poiService.getTitle(featureAfterConverstion, "he")).toBe("title");
                expect(featureAfterConverstion.properties.image).toBe("image-url");
                expect(featureAfterConverstion.properties.image0).toBeUndefined();
                expect(featureAfterConverstion.properties.poiIcon).toBe("icon-some-type");
            }
        )
    );

    it("should get closest point from server", (inject([PoiService, HttpTestingController],
        async (poiService: PoiService, mockBackend: HttpTestingController) => {

            let promise = poiService.getClosestPoint({lat: 0, lng: 0}).then((data: MarkerData) => {
                expect(data.latlng.lat).toBe(1);
                expect(data.latlng.lng).toBe(1);
            });

            mockBackend.expectOne((request: HttpRequest<any>) => request.url.includes(Urls.poiClosest))
                .flush({
                    type: "Feature",
                    properties: { "name:he": "name" },
                    geometry: { type: "Point", coordinates: [1, 1]}, } as GeoJSON.Feature);

            return promise;
        })
    ));

    it("should not get closest point from server when there's a server error", (inject([PoiService, HttpTestingController],
        async (poiService: PoiService, mockBackend: HttpTestingController) => {

            let promise = poiService.getClosestPoint({lat: 0, lng: 0}).then((data: MarkerData) => {
                expect(data).toBeNull();
            });

            mockBackend.expectOne((request: HttpRequest<any>) => request.url.includes(Urls.poiClosest))
                .flush("Invalid", { status: 400, statusText: "Bad Request"});

            return promise;
        })
    ));

    it("should return has extra data for feature with description", inject([PoiService], (poiService: PoiService) => {
        expect(poiService.hasExtraData({properties: { "description:he": "desc"}} as any as GeoJSON.Feature, "he")).toBeTruthy();
    }));

    it("should return has extra data for feature with image", inject([PoiService], (poiService: PoiService) => {
        expect(poiService.hasExtraData({properties: { image: "image-url"}} as any as GeoJSON.Feature, "he")).toBeTruthy();
    }));

    it("should return the itm coordinates for feature", inject([PoiService], (poiService: PoiService) => {
        let results = poiService.getItmCoordinates({properties: { poiItmEast: 1, poiItmNorth: 2}} as any as GeoJSON.Feature);
        expect(results.east).toBe(1);
        expect(results.north).toBe(2);
    }));

    it("should get contribution", inject([PoiService], (poiService: PoiService) => {
        let results = poiService.getContribution({properties: {
            poiLastModified: 1000, poiUserAddress: "address", poiUserName: "name"}
        } as any as GeoJSON.Feature);
        expect(results.lastModifiedDate).not.toBeNull();
        expect(results.userAddress).toBe("address");
        expect(results.userName).toBe("name");
    }));

    it("should get extenal description for hebrew", inject([PoiService], (poiService: PoiService) => {
        let results = poiService.getExternalDescription(
            {properties: { "poiExternalDescription:he": "desc"}} as any as GeoJSON.Feature, "he");
        expect(results).toBe("desc");
    }));

    it("should get extenal description for language independant", inject([PoiService], (poiService: PoiService) => {
        let results = poiService.getExternalDescription(
            {properties: { poiExternalDescription: "desc"}} as any as GeoJSON.Feature, "he");
        expect(results).toBe("desc");
    }));

    it("should get title when there's mtb name with language", inject([PoiService], (poiService: PoiService) => {
        let results = poiService.getTitle({properties: { "mtb:name:he": "name"}} as any as GeoJSON.Feature, "he");
        expect(results).toBe("name");
    }));

    it("should get title when there's mtb name without language", inject([PoiService], (poiService: PoiService) => {
        let results = poiService.getTitle({properties: { "mtb:name": "name"}} as any as GeoJSON.Feature, "he");
        expect(results).toBe("name");
    }));

    it("should get title even when there's no title for language description", inject([PoiService], (poiService: PoiService) => {
        let results = poiService.getTitle({properties: { name: "name"}} as any as GeoJSON.Feature, "he");
        expect(results).toBe("name");
    }));

    it("should get social links", inject([PoiService], (poiService: PoiService) => {
        let results = poiService.getPoiSocialLinks(
            {properties: { name: "name", poiGeolocation: {lat: 0, lng: 0}}} as any as GeoJSON.Feature);
        expect(results.facebook.includes(Urls.facebook)).toBeTruthy();
        expect(results.waze.includes(Urls.waze)).toBeTruthy();
    }));

    it("should sync categories when no categories exist", (inject([PoiService, HttpTestingController, RunningContextService],
        async (poiService: PoiService, mockBackend: HttpTestingController, runningContextService: RunningContextService) => {
            MockNgRedux.store.getState = () => ({
                layersState: {
                    categoriesGroups: [{
                        type: "my-type",
                        visible: true,
                        categories: []
                    }]
                }
            });
            (runningContextService as any).isIFrame = false;

            let promise = poiService.syncCategories();

            mockBackend.match(u => u.url.startsWith(Urls.poiCategories)).forEach(m => m.flush([{
                color: "color",
                icon: "icon",
                name: "name",
                visible: false,
                items: [{iconColorCategory: {
                    color: "color",
                    icon: "icon",
                    label: "label"
                }}]
            }] as Category[]));

            await promise;
            let calls = (MockNgRedux.store.dispatch as jasmine.Spy<jasmine.Func>).calls;
            expect(MockNgRedux.store.dispatch).toHaveBeenCalledTimes(1);
            expect(calls.first().args[0].payload.category.name).toBe("name");
    })));

    it("should sync categories and hide on iFrame", (inject([PoiService, HttpTestingController, RunningContextService],
        async (poiService: PoiService, mockBackend: HttpTestingController, runningContextService: RunningContextService) => {
            MockNgRedux.store.getState = () => ({
                layersState: {
                    categoriesGroups: [{
                        type: "my-type",
                        visible: true,
                        categories: []
                    }]
                }
            });
            (runningContextService as any).isIFrame = true;
            let promise = poiService.syncCategories();

            mockBackend.match(u => u.url.startsWith(Urls.poiCategories)).forEach(m => m.flush([{
                color: "color",
                icon: "icon",
                name: "name",
                visible: false,
                items: [{iconColorCategory: {
                    color: "color",
                    icon: "icon",
                    label: "label"
                }}]
            }] as Category[]));

            await promise;
            let calls = (MockNgRedux.store.dispatch as jasmine.Spy<jasmine.Func>).calls;
            expect(MockNgRedux.store.dispatch).toHaveBeenCalledTimes(2);
            expect(calls.first().args[0].payload.visible).toBeFalsy();
    })));

    it("should sync categories when categories are not the same", (inject([PoiService, HttpTestingController, RunningContextService],
        async (poiService: PoiService, mockBackend: HttpTestingController, runningContextService: RunningContextService) => {
            MockNgRedux.store.getState = () => ({
                layersState: {
                    categoriesGroups: [{
                        type: "my-type",
                        visible: true,
                        categories: [{
                            color: "color",
                            icon: "icon",
                            name: "name",
                            visible: false,
                            items: [{iconColorCategory: {
                                color: "color",
                                icon: "icon",
                                label: "label"
                            }}]
                        }]
                    }]
                }
            });
            (runningContextService as any).isIFrame = false;

            let promise = poiService.syncCategories();

            mockBackend.match(u => u.url.startsWith(Urls.poiCategories)).forEach(m => m.flush([{
                color: "color",
                icon: "icon",
                name: "name",
                visible: false,
                items: [{iconColorCategory: {
                    color: "color",
                    icon: "icon",
                    label: "label2"
                }}]
            }] as Category[]));

            await promise;
            let calls = (MockNgRedux.store.dispatch as jasmine.Spy<jasmine.Func>).calls;
            expect(MockNgRedux.store.dispatch).toHaveBeenCalledTimes(1);
            expect(calls.first().args[0].payload.category.items[0].iconColorCategory.label).toBe("label2");
    })));

    it("should sync categories when categories are not the same but ignore visibility",
        (inject([PoiService, HttpTestingController, RunningContextService],
        async (poiService: PoiService, mockBackend: HttpTestingController, runningContextService: RunningContextService) => {
            MockNgRedux.store.getState = () => ({
                layersState: {
                    categoriesGroups: [{
                        type: "my-type",
                        visible: true,
                        categories: [{
                            color: "color",
                            icon: "icon",
                            name: "name",
                            visible: false,
                            items: [{iconColorCategory: {
                                color: "color",
                                icon: "icon",
                                label: "label"
                            }}]
                        }]
                    }]
                }
            });
            (runningContextService as any).isIFrame = false;

            let promise = poiService.syncCategories();

            mockBackend.match(u => u.url.startsWith(Urls.poiCategories)).forEach(m => m.flush([{
                color: "color",
                icon: "icon",
                name: "name",
                visible: true,
                items: [{iconColorCategory: {
                    color: "color",
                    icon: "icon",
                    label: "label"
                }}]
            }] as Category[]));

            await promise;
            expect(MockNgRedux.store.dispatch).toHaveBeenCalledTimes(0);
    })));

    it("should sync categories when need to remove a category", (inject([PoiService, HttpTestingController, RunningContextService],
        async (poiService: PoiService, mockBackend: HttpTestingController, runningContextService: RunningContextService) => {
            MockNgRedux.store.getState = () => ({
                layersState: {
                    categoriesGroups: [{
                        type: "my-type",
                        visible: true,
                        categories: [{
                            color: "color",
                            icon: "icon",
                            name: "name",
                            visible: false,
                            items: [{iconColorCategory: {
                                color: "color",
                                icon: "icon",
                                label: "label"
                            }}]
                        }]
                    }]
                }
            });
            (runningContextService as any).isIFrame = false;

            let promise = poiService.syncCategories();

            mockBackend.match(u => u.url.startsWith(Urls.poiCategories)).forEach(m => m.flush([]));

            await promise;
            let calls = (MockNgRedux.store.dispatch as jasmine.Spy<jasmine.Func>).calls;
            expect(MockNgRedux.store.dispatch).toHaveBeenCalledTimes(1);
            expect(calls.first().args[0].payload.categoryName).toBe("name");
    })));
});
