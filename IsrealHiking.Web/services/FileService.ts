module IsraelHiking.Services {

    export class FileService {
        private static MAX_SEGMENTS_NUMBER = 20;
        private static MINIMAL_SEGMENT_LENGTH = 500; // meter

        private $q: angular.IQService;
        private parserFactory: Parsers.ParserFactory;
        private elevationProvider: Services.Elevation.IElevationProvider;
        private Upload: angular.angularFileUpload.IUploadService;


        constructor($q: angular.IQService,
            parserFactory: Parsers.ParserFactory,
            elevationProvider: Services.Elevation.IElevationProvider,
            Upload: angular.angularFileUpload.IUploadService) {
            this.$q = $q;
            this.parserFactory = parserFactory;
            this.elevationProvider = elevationProvider;
            this.Upload = Upload;
        }

        public saveToFile = (fileName: string, data: Common.DataContainer): angular.IPromise<{}> => {
            var extension = fileName.split('.').pop();
            var geoJsonParser = this.parserFactory.Create(Parsers.ParserType.geojson);
            var geoJsonString = geoJsonParser.toString(data);
            var geoJsonBlob = new Blob([geoJsonString], { type: "application/json" });
            if (extension == Parsers.ParserType.geojson) {
                saveAs(geoJsonBlob, fileName);
                return this.$q.resolve("");
            }
            return this.uploadForConversionAndSave(geoJsonBlob, extension, fileName);            
        }

        public uploadForConversionAndSave = (blob: Blob, format: string, fileName: string) : angular.IHttpPromise<{}> => {
            return this.Upload.upload(<angular.angularFileUpload.IFileUploadConfigFile>{
                data: { file: blob },
                url: Common.Urls.convertFiles + "?outputFormat=" + format,
            }).success((data: any) => {
                var byteCharacters = atob(data);
                var byteNumbers = new Array(byteCharacters.length);
                for (var i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                var byteArray = new Uint8Array(byteNumbers);
                var blob = new Blob([byteArray], { type: "application/octet-stream" });
                saveAs(blob, fileName);
            });
        }

        public readFromFile = (content: GeoJSON.FeatureCollection): Common.DataContainer => {
            var geoJsonParser = this.parserFactory.Create(Parsers.ParserType.geojson);
            var data = geoJsonParser.parse(JSON.stringify(content));
            data.routes = this.manipulateRoutesData(data.routes, Common.RoutingType.none);
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