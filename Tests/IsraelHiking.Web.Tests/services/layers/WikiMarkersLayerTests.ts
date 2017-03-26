/// <reference path="../../../../israelhiking.web/wwwroot/scripts/typings/leaflet-markercluster/leaflet-markercluster.d.ts" />
/// <reference path="../mapservicemockcreator.ts" />
/// <reference path="../../../../IsraelHiking.web/wwwroot/services/objectwithmap.ts" />
/// <reference path="../../../../IsraelHiking.web/wwwroot/services/iconsservice.ts" />
/// <reference path="../../../../IsraelHiking.web/wwwroot/services/layers/WikiMarkersLayer.ts" />

namespace IsraelHiking.Tests.Services.Layers {
    describe("Wiki layer Service", () => {
        var $http: angular.IHttpService;
        var $httpBackend: angular.IHttpBackendService;
        var wikiLayer: IsraelHiking.Services.Layers.WikiMarkersLayer;
        var mapServiceMock: MapServiceMockCreator;
        var fakeResourceService: any;

        beforeEach(() => {
            angular.mock.module("toastr");
            angular.mock.module("LocalStorageModule");
            angular.mock.inject((_$http_: angular.IHttpService, _$httpBackend_: angular.IHttpBackendService, _$document_: angular.IDocumentService, _$rootScope_: angular.IRootScopeService, _localStorageService_: angular.local.storage.ILocalStorageService) => {
                // The injector unwraps the underscores (_) from around the parameter names when matching
                $http = _$http_;
                $httpBackend = _$httpBackend_;
                mapServiceMock = new MapServiceMockCreator(_$document_, _localStorageService_);
                (mapServiceMock.mapService.map as any)._layersMaxZoom = 19; // workaround for markercluster issue
                fakeResourceService = { currentLanguage: { code: "he", rtl: true } as IsraelHiking.Services.ILanguage } as any;
                wikiLayer = new IsraelHiking.Services.Layers.WikiMarkersLayer($http, _$rootScope_, mapServiceMock.mapService, fakeResourceService as IsraelHiking.Services.ResourcesService);
            });
        });

        afterEach(() => {
            mapServiceMock.destructor();
        });

        it("Should run on add when adding to map", () => {
            spyOn(wikiLayer, "onAdd");

            mapServiceMock.mapService.map.addLayer(wikiLayer);

            expect(wikiLayer.onAdd).toHaveBeenCalled();
        });

        it("Should run on remove when removing from map", () => {
            spyOn(wikiLayer, "onRemove");

            mapServiceMock.mapService.map.addLayer(wikiLayer);
            mapServiceMock.mapService.map.removeLayer(wikiLayer);

            expect(wikiLayer.onRemove).toHaveBeenCalled();
        });

        it("Should be disabled when not added to map", () => {
            mapServiceMock.mapService.map.addLayer(wikiLayer);
            mapServiceMock.mapService.map.removeLayer(wikiLayer);

            $httpBackend.verifyNoOutstandingRequest();
            expect(0).toBe(0);
        });

        it("Should get wiki markers when zoom is above 12 on map move in hebrew", () => {
            const ADDRESS = "https://he.wikipedia.org/w/api.php?format=json&action=query&prop=coordinates&generator=geosearch&ggsradius=10000&ggscoord=0|0&ggslimit=500&callback=JSON_CALLBACK";
            $httpBackend.whenJSONP(ADDRESS).respond({
                query: {
                    pages: [
                        {
                            pageid: 1,
                            title: "title",
                            coordinates: [{
                                lat: 0,
                                lon: 0,
                            }],
                            extract: "extract",
                            thumbnail: {
                                height: 1,
                                original: "original",
                                source: "source",
                                width: 1
                            }
                        } as IsraelHiking.Services.Layers.IWikiPage
                    ] as IsraelHiking.Services.Layers.IWikiPage[]
                } as IsraelHiking.Services.Layers.IWikiQuery 
                
            } as IsraelHiking.Services.Layers.IWikiResponse);
            mapServiceMock.mapService.map.panTo(L.latLng(0, 0));

            mapServiceMock.mapService.map.addLayer(wikiLayer);
            mapServiceMock.mapService.map.setZoom(15);

            $httpBackend.flush();

            $httpBackend.expectJSONP(ADDRESS);
            expect(0).toBe(0);
        });

        it("Should get wiki markers when zoom is above 12 on map move in english and get details when clicked", () => {
            fakeResourceService.currentLanguage.code = "en-US";
            fakeResourceService.currentLanguage.trl = false;
            var response = {
                query: {
                    pages: [
                        {
                            pageid: 1,
                            title: "title",
                            coordinates: [{
                                lat: 2,
                                lon: 3,
                            }],
                            extract: "extract",
                            thumbnail: {
                                height: 4,
                                original: "original",
                                source: "source",
                                width: 5
                            }
                        } as IsraelHiking.Services.Layers.IWikiPage
                    ] as IsraelHiking.Services.Layers.IWikiPage[]
                } as IsraelHiking.Services.Layers.IWikiQuery
            } as IsraelHiking.Services.Layers.IWikiResponse;
            const ADDRESS = "https://en.wikipedia.org/w/api.php?format=json&action=query&prop=coordinates&generator=geosearch&ggsradius=10000&ggscoord=0|0&ggslimit=500&callback=JSON_CALLBACK";
            $httpBackend.whenJSONP(ADDRESS).respond(response);
            mapServiceMock.mapService.map.panTo(L.latLng(0, 0));

            mapServiceMock.mapService.map.addLayer(wikiLayer);
            mapServiceMock.mapService.map.setZoom(15);

            $httpBackend.flush();
            $httpBackend.expectJSONP(ADDRESS);
            $httpBackend.resetExpectations();

            const DETAILSADDRESS = "https://en.wikipedia.org/w/api.php?format=json&action=query&pageids=1&prop=extracts|pageimages&explaintext=true&exintro=true&exsentences=1&callback=JSON_CALLBACK";
            $httpBackend.whenJSONP(DETAILSADDRESS).respond(response);
            mapServiceMock.mapService.map.eachLayer((l) => {
                if (l instanceof L.MarkerClusterGroup)
                {
                    l.eachLayer(m => {
                        if (m instanceof L.Marker)
                        {
                            m.fire("popupopen");
                        }
                    });
                }
            });
            $httpBackend.flush();
            $httpBackend.expectJSONP(DETAILSADDRESS);
            expect(0).toBe(0);
        });
    });
}