import { TestBed, inject } from "@angular/core/testing";
import { HttpClientModule, HttpRequest } from "@angular/common/http";
import { HttpClientTestingModule, HttpTestingController } from "@angular/common/http/testing";
import { Device } from "@ionic-native/device/ngx";

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
import { GeoJsonParser } from "./geojson.parser";
import { SQLite } from "@ionic-native/sqlite/ngx";
import { Urls } from "../urls";
import { PointOfInterestExtended } from "../models/models";
import { NgReduxTestingModule, MockNgRedux } from "@angular-redux/store/testing";
import { MapService } from "./map.service";

describe("Poi Service", () => {

    beforeEach(() => {
        let toastMock = new ToastServiceMockCreator();
        let hashService = {};
        let fileServiceMock = {};
        let databaseServiceMock = {
            getPoisForClustering: () => Promise.resolve([])
        };
        let mapServiceMosk = {
            map: {
                on: () => { },
                off: () => { },
            }
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
                GeoJsonParser,
                RunningContextService,
                WhatsAppService,
                PoiService,
                LoggingService,
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
                    categoriesGroups: [{ type: "type", categories: [], visible: true }]
                }
            });
            let changed = false;
            poiService.poisChanged.subscribe(() => changed = true);
            let promise = poiService.initialize();
            mockBackend.match(r => r.url.startsWith(Urls.poiCategories)).forEach(t => t.flush([{ icon: "icon", name: "category" }]));
            await new Promise((resolve) => setTimeout(resolve, 100)); // this is in order to let the code continue to run to the next await
            // mockBackend.match(r => r.url === Urls.slimGeoJSON)[0].flush({ type: "FeatureCollection", features: [] });

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

            mockBackend.expectOne((request: HttpRequest<any>) => {
                return request.url.includes(id) &&
                    request.url.includes(source);
            }).flush({});
            return promise;
        })));

    it("Should update point using the server and convert images to files",
        inject([PoiService, HttpTestingController],
            async (poiService: PoiService, mockBackend: HttpTestingController) => {

                let poiExtended = { imagesUrls: ["http://link.com"] } as PointOfInterestExtended;
                let promise = poiService.uploadPoint(poiExtended).then((res) => {
                    expect(res).not.toBeNull();
                });

                mockBackend.expectOne((request) => request.url.includes(Urls.poi)).flush({});
                return promise;
            }));
});
