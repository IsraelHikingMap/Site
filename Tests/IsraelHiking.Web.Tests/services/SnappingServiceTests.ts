/// <reference path="mapservicemockcreator.ts" />
/// <reference path="../../../israelhiking.web/wwwroot/services/mapservice.ts" />
/// <reference path="../../../israelhiking.web/wwwroot/services/snappingservice.ts" />
/// <reference path="../../../israelhiking.web/wwwroot/services/objectwithmap.ts" />

namespace IsraelHiking.Tests.Services {
    describe("Snapping Service", () => {
        var $http: angular.IHttpService;
        var $httpBackend: angular.IHttpBackendService;
        var snappingService: IsraelHiking.Services.SnappingService;
        var mapServiceMock: MapServiceMockCreator;

        beforeEach(() => {
            angular.mock.module("toastr");
            angular.mock.module("LocalStorageModule");
            angular.mock.module("gettext");
            angular.mock.inject((_$http_: angular.IHttpService, _$httpBackend_: angular.IHttpBackendService, _$document_: angular.IDocumentService, _localStorageService_: angular.local.storage.ILocalStorageService, _gettextCatalog_: angular.gettext.gettextCatalog, _toastr_: Toastr) => {
                // The injector unwraps the underscores (_) from around the parameter names when matching
                $http = _$http_;
                $httpBackend = _$httpBackend_;
                mapServiceMock = new MapServiceMockCreator(_$document_, _localStorageService_);
                _toastr_.error = (): any => { };
                $httpBackend.whenGET(url => url.indexOf(Common.Urls.translations) !== -1).respond(404, {}); // ignore resources get request
                snappingService = new IsraelHiking.Services.SnappingService($http, new IsraelHiking.Services.ResourcesService(null, _localStorageService_, _gettextCatalog_), mapServiceMock.mapService, _toastr_);
                snappingService.enable(true);
            });
        });

        afterEach(() => {
            mapServiceMock.destructor();
        });

        it("Should clear snappings layer when disabled", () => {
            snappingService.enable(false);
            mapServiceMock.mapService.map.setZoom(14); // this fires moveend

            expect(snappingService.snappings.getLayers().length).toBe(0);
            expect(snappingService.isEnabled()).toBe(false);
        });

        it("Should clear snappings layer when zoom is less than 14", () => {
            mapServiceMock.mapService.map.setZoom(12); // this fires moveend

            expect(snappingService.snappings.getLayers().length).toBe(0);
        });

        it("Should add one snappings linestring when zoom is 14", () => {
            let features = [
                {
                    type: "Feature",
                    geometry: {
                        type: "LineString",
                        coordinates: [[1, 2], [3, 4]]
                    } as GeoJSON.LineString
                } as GeoJSON.Feature<GeoJSON.LineString>
            ];
            $httpBackend.whenGET(() => true).respond(features);

            mapServiceMock.mapService.map.setZoom(14);
            $httpBackend.flush();

            expect(snappingService.snappings.getLayers().length).toBe(1);
        });

        it("Should add one snappings polygon when zoom is 14", () => {
            let features = [
                {
                    type: "Feature",
                    geometry: {
                        type: "Polygon",
                        coordinates: [[[1, 2], [3, 4], [5,6], [1,2]]]
                    } as GeoJSON.Polygon
                } as GeoJSON.Feature<GeoJSON.Polygon>
            ];
            $httpBackend.whenGET(() => true).respond(features);

            mapServiceMock.mapService.map.setZoom(14);
            $httpBackend.flush();

            expect(snappingService.snappings.getLayers().length).toBe(1);
        });

        it("Should clear layer upon http error", () => {
            snappingService.snappings.addLayer(L.polyline([L.latLng(1, 1), L.latLng(2, 2)]));
            expect(snappingService.snappings.getLayers().length).toBe(1);
            $httpBackend.whenGET(() => true).respond(500, {});

            mapServiceMock.mapService.map.setZoom(14);
            $httpBackend.flush();

            expect(snappingService.snappings.getLayers().length).toBe(0);
        });


        it("Should snap to its own layers", () => {
            snappingService.snappings.addLayer(L.polyline([L.latLng(1, 1), L.latLng(1, 2)]));

            let snap = snappingService.snapTo(L.latLng(1.00001, 1));

            expect(snap.latlng.lat).toBe(1.0);
            expect(snap.latlng.lng).toBe(1.0); 
        });

        it("Should snap to closest point", () => {
            snappingService.snappings.addLayer(L.polyline([L.latLng(1, 1), L.latLng(1, 1.00001), L.latLng(1, 2)]));

            let snap = snappingService.snapTo(L.latLng(1, 1.0001));

            expect(snap.latlng.lng).toBeGreaterThan(1.0);
        });

        it("Should snap to its own layers but ignore a line with single point", () => {
            snappingService.snappings.addLayer(L.polyline([L.latLng(1, 1)]));
            snappingService.snappings.addLayer(L.polyline([L.latLng(1, 1), L.latLng(1, 2)]));

            let snap = snappingService.snapTo(L.latLng(1.00001, 1));

            expect(snap.latlng.lat).toBe(1.0);
            expect(snap.latlng.lng).toBe(1.0); 
        });
        it("Should snap to a given layer", () => {
            let layers = L.layerGroup([]); 
            layers.addLayer(L.polyline([L.latLng(1, 1), L.latLng(1, 2)]));

            let snap = snappingService.snapTo(L.latLng(1.01, 1), { layers: layers, sensitivity: 1000 } as IsraelHiking.Services.ISnappingOptions);

            expect(snap.latlng.lat).toBe(1.0);
            expect(snap.latlng.lng).toBe(1.0); 
        });
        it("Should not snap when there are no layers", () => {
            let snap = snappingService.snapTo(L.latLng(10, 10));

            expect(snap.polyline).toBeNull();
        });
        it("Should not snap when point is too far", () => {
            snappingService.snappings.addLayer(L.polyline([L.latLng(1, 1), L.latLng(2, 2)]));

            let snap = snappingService.snapTo(L.latLng(10, 10));

            expect(snap.polyline).toBeNull();
        });
    });
}