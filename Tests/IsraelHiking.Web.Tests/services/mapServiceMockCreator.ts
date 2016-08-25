namespace IsraelHiking.Tests.Services {
    export class MapServiceMockCreator {
        public static createMapDiv($document: angular.IDocumentService): JQuery {
            let mapDiv = angular.element("<div>");
            mapDiv.attr("id", "map");
            $document.find("body").eq(0).append(mapDiv);
            return mapDiv;
        }    
    }
    
}