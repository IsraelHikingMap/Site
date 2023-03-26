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

// Tile from https://israelhiking.osm.org.il/vector/data/IHM/14/9788/6769.pbf that has a single highway in it
// See here: https://israelhiking.osm.org.il/map/15.13/29.8131/35.0839
// eslint-disable-next-line
const base64Tile = "GoYECg50cmFuc3BvcnRhdGlvbhLOARIKAAAUARYCGgAbABgCIr0BCYBBiAmSBC8UzwFabTC5AVClAUDxAWaPAmw3GN8BXvEBZsMBUpMBOu8BZN8BXpcCfoMBPjseaTZ3PqkBVk8oXTZbNIcBUI0BVlc0TTBlQmtIowFwvQGEAYUBYo8BbJMBds0BqgGhAYgBX1Z1aokBfokBiAGjAaABXWSjAa4BlwGqAWFyR1ZRZnOQAUFSNURrkgF9rgF5rgFfjgFXhgFbkgFJeGOoAVeaAUWCAVGWAVOsAUeSAVvGAUusARtEGgVjbGFzcxoIc3ViY2xhc3MaB25ldHdvcmsaBm9uZXdheRoEcmFtcBoHYnJ1bm5lbBoHc2VydmljZRoGYWNjZXNzGgR0b2xsGgpleHByZXNzd2F5GgVsYXllchoFbGV2ZWwaBmluZG9vchoHYmljeWNsZRoEZm9vdBoFaG9yc2UaCW10Yl9zY2FsZRoJdHJhY2t0eXBlGgZjb2xvdXIaB2NvbG91cjIaB3N1cmZhY2UaCm9uZXdheTptdGIaCG1heHNwZWVkGghjeWNsZXdheRoNY3ljbGV3YXk6bGVmdBoOY3ljbGV3YXk6cmlnaHQaCWlobV9jbGFzcxoLaWxtdGJfY2xhc3MiBwoFdHJ1bmsiBwoFcGF2ZWQiBQoDMTAwKIAgeAIapQQKE3RyYW5zcG9ydGF0aW9uX25hbWUS2AESDgAAAQACAAwBDQIOAw8EGAIiwwEJgELUCKIErwFIzwFabTC5AVClAUDxAWaPAmw3GN8BXvEBZsMBUpMBOu8BZN8BXpcCfoMBPjseaTZ3PqkBVk8oXTZbNIcBUI0BVlc0TTBlQmtIowFwvQGEAYUBYo8BbJMBds0BqgGhAYgBX1Z1aokBfokBiAGjAaABXWSjAa4BlwGqAWFyR1ZRZnOQAUFSNURrkgF9rgF5rgFfjgFXhgFbkgFJeGOoAVeaAUWCAVGWAVOsAUeSAVvGAUusAS1wR6IBJV4aBG5hbWUaB25hbWVfZW4aB25hbWVfZGUaCG10YjpuYW1lGgttdGI6bmFtZTplbhoLbXRiOm5hbWU6aGUaB25hbWU6ZGUaB25hbWU6ZW4aB25hbWU6aGUaCG5hbWVfaW50GgpuYW1lOmxhdGluGg1uYW1lOm5vbmxhdGluGgNyZWYaCnJlZl9sZW5ndGgaB25ldHdvcmsaBWNsYXNzGghzdWJjbGFzcxoHYnJ1bm5lbBoFbGF5ZXIaBWxldmVsGgZpbmRvb3IaB3JvdXRlXzEaB3JvdXRlXzIaB3JvdXRlXzMaB3JvdXRlXzQaB3JvdXRlXzUaB3JvdXRlXzYiFwoVSm9yZGFuIFZhbGxleSBIaWdod2F5IgQKAjY1IgIoAiIGCgRyb2FkIgcKBXRydW5rKIAgeAIa/gEKCGl0bV9ncmlkEhMSCAAAAQECAgMDGAEiBQmCFbwYEhMSCAAEAQECAwMDGAEiBQmSM7gYEhMSCAAAAQUCAgMCGAEiBQmGFeA2EhYSBAAEAgMYAiIMCZgzgEESBccoA7cZEhMSBAAAAgIYAiIJCYgVgEEKCf9BEhISBAEFAwIYAiIICX/iNgqAQgcSGBIEAQEDAxgCIg4Jf74YGoIWAZAeA+4NARITEggABAEFAgMDAhgBIgUJljPcNhoEZWFzdBoFbm9ydGgaCWVhc3RfcmFuaxoKbm9ydGhfcmFuayIDKM8BIgMongMiAigBIgIoAiIDKNABIgMonQMogCB4Ag==";

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
                { provide: LoggingService, useValue: {} },
                { provide: RunningContextService, useValue: null },
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

            db.getTile = () => fetch(`data:application/x-protobuf;base64,${base64Tile}`).then(r => r.arrayBuffer());

            MockNgRedux.store.getState = () => ({
                offlineState: {
                    isOfflineAvailable: true,
                    lastModifiedDate: new Date()
                }
            });

            let promise = router.getRoute({ lat: 29.807326, lng: 35.071012 }, { lat: 29.817968, lng: 35.088073 }, "Hike").then((data) => {
                expect(data.length).toBe(48);
            }, fail);

            mockBackend.expectOne(() => true).flush(null, { status: 500, statusText: "Server error" });
            return promise;
        }
    ));
});
