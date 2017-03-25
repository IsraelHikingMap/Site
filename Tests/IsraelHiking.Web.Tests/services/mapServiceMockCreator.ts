namespace IsraelHiking.Tests.Services {
    export class MapServiceMockCreator {
        private mapDiv: JQuery;
        public mapService: IsraelHiking.Services.MapService;

        public constructor($document: angular.IDocumentService, localStorageService: angular.local.storage.ILocalStorageService) {
            this.mapDiv = angular.element("<div>");
            this.mapDiv.attr("id", "map");
            $document.find("body").eq(0).append(this.mapDiv);
            this.mapService = new IsraelHiking.Services.MapService(localStorageService);
        }

        public destructor()
        {
            this.mapDiv.remove();
            this.mapDiv = null;
        }

    }
    
}