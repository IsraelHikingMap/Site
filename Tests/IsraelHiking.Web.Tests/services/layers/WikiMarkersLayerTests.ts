/// <reference path="../mapservicemockcreator.ts" />
/// <reference path="../../../../isrealhiking.web/services/objectwithmap.ts" />
/// <reference path="../../../../isrealhiking.web/services/iconsservice.ts" />
/// <reference path="../../../../isrealhiking.web/services/layers/WikiMarkersLayer.ts" />

namespace IsraelHiking.Tests.Services.Layers {
    describe("Wiki layer Service", () => {
        const ADDRESS = `https://he.wikipedia.org/w/api.php?format=json&action=query&list=geosearch&gsradius=10000&gscoord=0|0&gslimit=500&callback=JSON_CALLBACK`;
        var $http: angular.IHttpService;
        var $httpBackend: angular.IHttpBackendService;
        var mapDiv: JQuery;
        var mapService: IsraelHiking.Services.MapService;
        var wikiLayer: IsraelHiking.Services.Layers.WikiMarkersLayer;

        beforeEach(() => {
            angular.mock.module("toastr");
            angular.mock.inject((_$http_: angular.IHttpService, _$httpBackend_: angular.IHttpBackendService, _$document_: angular.IDocumentService) => { // 
                // The injector unwraps the underscores (_) from around the parameter names when matching
                $http = _$http_;
                $httpBackend = _$httpBackend_;
                mapDiv = MapServiceMockCreator.createMapDiv(_$document_);
                mapService = new IsraelHiking.Services.MapService();
                wikiLayer = new IsraelHiking.Services.Layers.WikiMarkersLayer($http, mapService);
            });
        });

        afterEach(() => {
            mapDiv.remove();
            mapDiv = null;
        });

        it("Should run on add when adding to map", () => {
            spyOn(wikiLayer, "onAdd");

            mapService.map.addLayer(wikiLayer);

            expect(wikiLayer.onAdd).toHaveBeenCalled();
        });

        it("Should run on remove when removing from map", () => {
            spyOn(wikiLayer, "onRemove");

            mapService.map.addLayer(wikiLayer);
            mapService.map.removeLayer(wikiLayer);

            expect(wikiLayer.onRemove).toHaveBeenCalled();
        });

        it("Should be disabled when not added to map", () => {
            mapService.map.addLayer(wikiLayer);
            mapService.map.removeLayer(wikiLayer);

            $httpBackend.verifyNoOutstandingRequest();
            expect(0).toBe(0);
        });


        it("Should get wiki markers when zoom is above 12 on map move", () => {
            $httpBackend.whenJSONP(ADDRESS).respond({
                query: {
                    geosearch: [
                        {
                            title: "title",
                            lat: 0,
                            lon: 0,
                            pageid: 1
                        } as IsraelHiking.Services.Layers.IWikiPage
                    ] as IsraelHiking.Services.Layers.IWikiPage[]
                } as IsraelHiking.Services.Layers.IWikiQuery 
                
            } as IsraelHiking.Services.Layers.IWikiResponse);
            mapService.map.panTo(L.latLng(0, 0));

            mapService.map.addLayer(wikiLayer);
            mapService.map.setZoom(15);

            $httpBackend.flush();

            $httpBackend.expectJSONP(ADDRESS);
            expect(0).toBe(0);
        });
    });
}