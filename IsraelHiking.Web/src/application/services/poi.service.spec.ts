import { TestBed, inject } from "@angular/core/testing";
import { HttpClientModule, HttpRequest } from "@angular/common/http";
import { HttpClientTestingModule, HttpTestingController } from "@angular/common/http/testing";
import { Device } from "@ionic-native/device/ngx";
import { SQLite } from "@ionic-native/sqlite/ngx";

import { NgReduxTestingModule, MockNgRedux } from "../reducers/infra/ng-redux-testing.module";
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
import { ApplicationState } from "../models/models";
import { Urls } from "../urls";

describe("Poi Service", () => {

    beforeEach(() => {
        let toastMock = new ToastServiceMockCreator();
        let hashService = {};
        let fileServiceMock = {};
        let databaseServiceMock = {
            getPoisForClustering: () => Promise.resolve([]),
            addPoiToUploadQueue: () => Promise.resolve()
        } as any;
        let mapServiceMosk = {
            map: {
                on: () => { },
                off: () => { },
                getCenter: () => ({ lat: 0, lng: 0})
            }
        };
        let loggingService = {
            info: () => {}
        };
        TestBed.configureTestingModule({
            imports: [
                HttpClientModule,
                HttpClientTestingModule,
                NgReduxTestingModule
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
                PoiService,
                Device,
                SQLite
            ]
        });
        MockNgRedux.reset();
    });

    it("Should initialize and sync categories from server", (inject([PoiService, HttpTestingController],
        async (poiService: PoiService, mockBackend: HttpTestingController) => {

            MockNgRedux.getInstance().getState = () => ({
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
        })));

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
        })));

    it("Should create simple point",
        inject([PoiService],
            async (poiService: PoiService) => {

                MockNgRedux.getInstance().dispatch = jasmine.createSpy();

                let promise = poiService.addSimplePoint({ lat: 0, lng: 0}, "Tap").then(() => {
                    expect(MockNgRedux.getInstance().dispatch).toHaveBeenCalled();
                });

                return promise;
            }
        )
    );

    it("Should create complex point",
        inject([PoiService, DatabaseService],
            async (poiService: PoiService, dbMock: DatabaseService) => {

                MockNgRedux.getInstance().dispatch = jasmine.createSpy();
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
                    urls: ["some-url"]
                }, { lat: 0, lng: 0}).then(() => {
                    expect(MockNgRedux.getInstance().dispatch).toHaveBeenCalled();
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

                MockNgRedux.getInstance().dispatch = jasmine.createSpy();
                MockNgRedux.getInstance().getState = () => ({
                        poiState: {
                            selectedPointOfInterest: {
                                properties: {
                                    poiSource: "OSM",
                                    poiId: "poiId",
                                    identifier: "id"
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
                    urls: ["some-url"]
                }, { lat: 1, lng: 2}).then(() => {
                    expect(MockNgRedux.getInstance().dispatch).toHaveBeenCalled();
                    let feature = spy.calls.mostRecent().args[0];
                    expect(feature.properties.poiId).not.toBeNull();
                    expect(feature.properties.poiSource).toBe("OSM");
                    expect(feature.properties["description:he"]).toBe("description");
                    expect(poiService.getDescription(feature, "he")).toBe("description");
                    expect(feature.properties["name:he"]).toBe("title");
                    expect(poiService.getTitle(feature, "he")).toBe("title");
                    expect(feature.properties.poiAddedUrls).toEqual(["some-url"]);
                    expect(feature.properties.poiAddedImages).toEqual(["some-image-url"]);
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
                MockNgRedux.getInstance().dispatch = jasmine.createSpy();
                MockNgRedux.getInstance().getState = () => ({
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
                    urls: ["some-url"]
                }).then(() => {
                    expect(MockNgRedux.getInstance().dispatch).toHaveBeenCalled();
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

                poiService.mergeWithPoi(feature,
                    { description: "description", title: "title", type: "some-type", urls: [], latlng: { lng: 1, lat: 2}}
                );
                let info = poiService.getEditableDataFromFeature(feature);
                let featureAfterConverstion = poiService.getFeatureFromEditableData(info);
                poiService.setLocation(featureAfterConverstion, { lat: 2, lng: 1});
                expect(poiService.getLocation(featureAfterConverstion).lat).toBe(2);
                expect(poiService.getLocation(featureAfterConverstion).lng).toBe(1);
                expect(poiService.getDescription(featureAfterConverstion, "he")).toBe("description");
                expect(poiService.getTitle(featureAfterConverstion, "he")).toBe("title");
                expect(featureAfterConverstion.properties.poiIcon).toBe("icon-some-type");
            }
        )
    );
});
