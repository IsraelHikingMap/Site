module IsraelHiking.Services {

    export class FileService {
        private static MAX_SEGMENTS_NUMBER = 20;
        private static MINIMAL_SEGMENT_LENGTH = 500; // meter

        private parserFactory: Parsers.ParserFactory;
        private elevationProvider: Services.Elevation.IElevationProvider;

        constructor(parserFactory: Parsers.ParserFactory,
            elevationProvider: Services.Elevation.IElevationProvider) {
            this.parserFactory = parserFactory;
            this.elevationProvider = elevationProvider;
        }

        public saveToFile = (fileName: string, data: Common.DataContainer) => {
            var extension = fileName.split('.').pop();
            var parser = this.parserFactory.Create(extension);
            var dataString = parser.toString(data);
            var blob = new Blob([dataString], { type: "application/json" })
            var blobURL = ((<any>window).URL || (<any>window).webkitURL).createObjectURL(blob);
            var anchor = <any>document.createElement("a");
            anchor.style = "display: none";
            anchor.download = fileName;
            anchor.href = blobURL;
            document.body.appendChild(anchor);
            anchor.click();

            setTimeout(function () {
                document.body.removeChild(anchor);
                ((<any>window).URL || (<any>window).webkitURL).revokeObjectURL(blobURL);
            }, 100);
        }

        public readFromFile = (fileName: string, content: string, routingType: string): Common.DataContainer => {
            var extension = fileName.split('.').pop();
            var parser = this.parserFactory.Create(extension);
            if (parser == null) {
                return <Common.DataContainer> {
                    markers: [],
                    routes: [],
                };
            }
            var data = parser.parse(content);
            data.routes = this.manipulateRoutesData(data.routes, routingType);
            return data;
        }

        private manipulateRoutesData = (routesData: Common.RouteData[], routingType: string): Common.RouteData[]=> {
            var returnArray = <Common.RouteData[]>[];
            var latlngzsToUpdate = <Common.LatLngZ[]>[];
            for (var routeIndex = 0; routeIndex < routesData.length; routeIndex++) {
                var routeData = routesData[routeIndex];
                var manipulatedRouteData = <Common.RouteData> {
                    segments: [],
                    routingType: routingType,
                    name: routeData.name,
                };
                for (var segmentIndex = 0; segmentIndex < routeData.segments.length; segmentIndex++) {
                    var segmentLatLngZs = routeData.segments[segmentIndex].latlngzs;
                    var routeLength = 0;
                    for (var latlngIndex = 0; latlngIndex < segmentLatLngZs.length; latlngIndex++) {
                        latlngzsToUpdate.push(segmentLatLngZs[latlngIndex]);
                        if (latlngIndex > 0) {
                            routeLength += segmentLatLngZs[latlngIndex - 1].distanceTo(segmentLatLngZs[latlngIndex]);
                        }
                    }
                    var segmentLength = routeLength / FileService.MAX_SEGMENTS_NUMBER;
                    if (segmentLength < FileService.MINIMAL_SEGMENT_LENGTH) {
                        segmentLength = FileService.MINIMAL_SEGMENT_LENGTH;
                    }
                    var currentSegmentLength = 0;
                    var segmentData = <Common.RouteSegmentData> { latlngzs: [segmentLatLngZs[0]], routingType: routingType };
                    for (var latlngIndex = 1; latlngIndex < segmentLatLngZs.length; latlngIndex++) {
                        currentSegmentLength += segmentLatLngZs[latlngIndex - 1].distanceTo(segmentLatLngZs[latlngIndex]);
                        if (currentSegmentLength < segmentLength) {
                            segmentData.latlngzs.push(segmentLatLngZs[latlngIndex]);
                            continue;
                        }
                        segmentData.routePoint = segmentData.latlngzs[segmentData.latlngzs.length - 1];
                        manipulatedRouteData.segments.push(segmentData);
                        segmentData = <Common.RouteSegmentData> { latlngzs: [segmentLatLngZs[latlngIndex - 1], segmentLatLngZs[latlngIndex]], routingType: routingType };
                        currentSegmentLength = 0;
                    }
                    segmentData.routePoint = segmentData.latlngzs[segmentData.latlngzs.length - 1];
                    manipulatedRouteData.segments.push(segmentData);
                }
                returnArray.push(manipulatedRouteData);
            }
            
            this.elevationProvider.updateHeights(latlngzsToUpdate);
            return returnArray;
        }
    }

}