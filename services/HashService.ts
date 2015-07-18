module IsraelHiking.Services {
    interface IUrlSerachObject {
        markers: string;
    }

    export class HashService extends ObjectWithMap {
        private static ARRAY_DELIMITER = ":";
        private static DATA_DELIMITER = ",";

        private $location: angular.ILocationService;
        private $rootScope: angular.IScope;
        private layersService: LayersService;
        private drawingMarkerService: DrawingMarkerService;
        private ignoreChanges: boolean;

        constructor($location: angular.ILocationService,
            $rootScope: angular.IScope,
            mapSerivce: MapService,
            layersService: LayersService,
            drawingMarkerService: DrawingMarkerService) {
            super(mapSerivce);
            this.$location = $location;
            this.$rootScope = $rootScope;
            this.layersService = layersService;
            this.drawingMarkerService = drawingMarkerService;
            this.ignoreChanges = false;

            this.addDataFromUrl();

            this.layersService.eventHelper.addListener((data) => {
                if (this.ignoreChanges) {
                    return;
                }
                this.updateHashEventHandler();
            });
            this.drawingMarkerService.eventHelper.addListener((data) => {
                if (this.ignoreChanges) {
                    return;
                }
                this.updateHashEventHandler();
            });
            this.map.on("moveend",(e: L.LeafletEvent) => {
                this.updateHashEventHandler();
                if (!$rootScope.$$phase) {
                    this.$rootScope.$apply();
                }
            });
        }

        private updateHashEventHandler = () => {
            var center = this.map.getCenter();
            var zoom = this.map.getZoom();
            this.updateHash(center.lat, center.lng, zoom);
        }

        private updateHash = (lat: number, lng: number, zoom: number) => {
            var path = zoom + "/" + lat.toFixed(4) + "/" + lng.toFixed(4);
            var searchObject = this.dataContainerToUrlString();
            this.$location.path(path);
            this.$location.search(searchObject);
        }

        private routeToString = (routeData: Common.RouteData): string => {
            var latlngsString = this.latlngsToStringArray(this.pointSegmentsToLatlng(routeData.segments)).join(HashService.ARRAY_DELIMITER);
            return routeData.routingType + HashService.ARRAY_DELIMITER + latlngsString;
        }

        private stringToRoute = (data: string): Common.RouteData => {
            var splitted = data.split(HashService.ARRAY_DELIMITER);
            return <Common.RouteData> {
                name: "",
                routingType: splitted.shift(),
                segments: this.latlngToPointSegments(this.stringArrayToLatlngs(splitted)),
            };
        }

        private latlngsToStringArray(latlngs: L.LatLng[]): string[] {
            var array = <string[]>[];
            for (var latlngIndex = 0; latlngIndex < latlngs.length; latlngIndex++) {
                var latlng = latlngs[latlngIndex];
                array.push(latlng.lat.toFixed(4) + HashService.DATA_DELIMITER + latlng.lng.toFixed(4));
            }
            return array;
        }

        private stringArrayToLatlngs(stringArray: string[]): L.LatLng[] {
            var array = <L.LatLng[]>[];
            for (var stringIndex = 0; stringIndex < stringArray.length; stringIndex++) {
                var latlngStringArray = stringArray[stringIndex].split(HashService.DATA_DELIMITER);
                if (latlngStringArray.length != 2) {
                    continue;
                }
                array.push(new L.LatLng(parseFloat(latlngStringArray[0]), parseFloat(latlngStringArray[1])));
            }
            return array;
        }

        private markersToStringArray(markers: Common.MarkerData[]): string[] {
            var array = <string[]>[];
            for (var latlngIndex = 0; latlngIndex < markers.length; latlngIndex++) {
                var marker = markers[latlngIndex];
                var title = marker.title.replace(HashService.ARRAY_DELIMITER, " ").replace(HashService.DATA_DELIMITER, " ");
                array.push(marker.latlng.lat + HashService.DATA_DELIMITER + marker.latlng.lng + HashService.DATA_DELIMITER + title);
            }
            return array;
        }
        private stringArrayToMarkers(stringArray: string[]): Common.MarkerData[] {
            var array = <Common.MarkerData[]>[];
            for (var srtingIndex = 0; srtingIndex < stringArray.length; srtingIndex++) {
                var markerStringSplit = stringArray[srtingIndex].split(HashService.DATA_DELIMITER);
                if (markerStringSplit.length < 2) {
                    continue;
                }
                var title = "";
                if (markerStringSplit.length >= 3) {
                    title = markerStringSplit[2];
                }
                array.push(<Common.MarkerData> {
                    latlng: new L.LatLng(parseFloat(markerStringSplit[0]), parseFloat(markerStringSplit[1])),
                    title: title,
                });
            }
            return array;
        }

        private pointSegmentsToLatlng(pointSegments: Common.RouteSegmentData[]): L.LatLng[] {
            var array = <L.LatLng[]>[];
            for (var latlngIndex = 0; latlngIndex < pointSegments.length; latlngIndex++) {
                var pointSegment = pointSegments[latlngIndex];
                array.push(pointSegment.routePoint);
            }
            return array;
        }

        private latlngToPointSegments(latlngs: L.LatLng[]): Common.RouteSegmentData[] {
            var array = <Common.RouteSegmentData[]>[];
            for (var latlngIndex = 0; latlngIndex < latlngs.length; latlngIndex++) {
                var latlng = latlngs[latlngIndex];
                array.push(<Common.RouteSegmentData> {
                    routePoint: latlng,
                    latlngs: [],
                });
            }
            return array;
        }

        private dataContainerToUrlString = (): IUrlSerachObject => {
            var routesData = this.layersService.getData();
            var markers = this.drawingMarkerService.getData();

            var urlObject = <IUrlSerachObject> {
                markers: this.markersToStringArray(markers).join(HashService.ARRAY_DELIMITER),
            };
            for (var routeIndex = 0; routeIndex < routesData.length; routeIndex++) {
                var routeData = routesData[routeIndex];
                (<any>urlObject)[routeData.name] = this.routeToString(routeData);
            }
            return urlObject;
        }

        private urlStringToDataContainer(searchObject: IUrlSerachObject): Common.DataContainer {
            var data = <Common.DataContainer> {
                markers: [],
                routesData: [],
            };
            if (!searchObject) {
                return data;
            }
            if (searchObject.markers != undefined) {
                data.markers = this.stringArrayToMarkers(searchObject.markers.split(HashService.ARRAY_DELIMITER) || [])
            }
            for (var parameter in searchObject) {
                if (parameter == "markers") {
                    continue;
                }
                var routeData = this.stringToRoute(searchObject[parameter]);
                routeData.name = parameter;
                data.routesData.push(routeData);
            }

            return data;
        }

        private addDataFromUrl() {
            var path = this.$location.path();
            var splittedpath = path.split("/");
            var search = this.$location.search();
            var zoom = null;
            var lat = null;
            var lng = null;
            var hashOnly = true;
            if (splittedpath.length == 4) {
                this.ignoreChanges = true;
                zoom = parseInt(splittedpath[splittedpath.length - 3]);
                lat = parseFloat(splittedpath[splittedpath.length - 2]);
                lng = parseFloat(splittedpath[splittedpath.length - 1]);
                this.map.setZoom(zoom);
                //setTimeout(() => {
                    this.map.panTo(new L.LatLng(lat, lng));
                    // HM TODO: work around for zoom issue - remove when leaflet has a fixed?
                //}, 1000);
                var data = this.urlStringToDataContainer(search);
                this.layersService.setData(data.routesData, true);
                this.drawingMarkerService.setData(data.markers);
                this.ignoreChanges = false;
            } else {
                // backwards compatibility... :-(
                zoom = parseInt(this.getURLParameter('zoom'));
                lat = parseFloat(this.getURLParameter('lat'));
                lng = parseFloat(this.getURLParameter('lng'));
                if (zoom > 0 && lat > 0 && lng > 0) {
                    var href = window.location.pathname + "#/" + zoom + "/" + lat.toFixed(4) + "/" + lng.toFixed(4);
                    window.location.href = href;
                }
            }
        }
        private getURLParameter(name) {
            return decodeURIComponent((new RegExp('[?|&]' + name + '=' + '([^&;]+?)(&|#|;|$)').exec(location.search) || [, ""])[1].replace(/\+/g, '%20')) || null;
        }
    }
} 