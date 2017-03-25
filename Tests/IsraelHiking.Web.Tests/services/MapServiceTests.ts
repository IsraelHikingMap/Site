namespace IsraelHiking.Tests.Services {
    var mapServiceMock: MapServiceMockCreator;

    describe("Map Service", () => {
        var localStorageService: angular.local.storage.ILocalStorageService;

        beforeEach(() => {
            angular.mock.module("LocalStorageModule");
            angular.mock.inject((_$document_: angular.IDocumentService, _localStorageService_: angular.local.storage.ILocalStorageService) => { // 
                // The injector unwraps the underscores (_) from around the parameter names when matching
                localStorageService = _localStorageService_;
                mapServiceMock = new MapServiceMockCreator(_$document_, localStorageService);
            });
        });

        afterEach(() => {
            mapServiceMock.destructor();
        });

        it("Should initialize with default values", () => {
            expect(mapServiceMock.mapService.map.getCenter().lat).toBe(31.773);
            expect(mapServiceMock.mapService.map.getCenter().lng).toBe(35.12);
            expect(mapServiceMock.mapService.map.getZoom()).toBe(13);
        });

        it("Should update local storage on map move", () => {
            var spy = spyOn(localStorageService, "set")

            mapServiceMock.mapService.map.panTo(L.latLng(0, 0));

            expect(localStorageService.set).toHaveBeenCalled();
        });
    });
}