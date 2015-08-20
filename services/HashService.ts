module IsraelHiking.Services {
    export class HashService {
        private static ZOOM_KEY = "Zoom";
        private static LATLNG_KEY = "LatLng";
        private static ARRAY_DELIMITER = ";";
        private static SPILT_REGEXP = /[:;]+/;
        private static MARKER_SPECIAL_CHARACTERS_REGEXP = /[:;,]+/;
        private static DATA_DELIMITER = ",";
        private static PERSICION = 4;

        private $location: angular.ILocationService;
        private $rootScope: angular.IScope;
        private localStorageService: angular.local.storage.ILocalStorageService;
        private dataContainer: Common.DataContainer;

        public latlng: L.LatLng;
        public zoom: number;
        public searchTerm: string;
        public externalUrl: string;

        constructor($location: angular.ILocationService,
            $rootScope: angular.IScope,
            localStorageService: angular.local.storage.ILocalStorageService) {
            this.$location = $location;
            this.$rootScope = $rootScope;
            this.localStorageService = localStorageService;
            this.latlng = this.localStorageService.get<L.LatLng>(HashService.LATLNG_KEY) || new L.LatLng(31.773, 35.12);
            this.zoom = this.localStorageService.get<number>(HashService.ZOOM_KEY) || 13;
            this.dataContainer = <Common.DataContainer> { markers: [], routes: [] };
            this.searchTerm = "";
            this.addDataFromUrl();
        }

        public getDataContainer = (): Common.DataContainer => {
            return angular.copy(this.dataContainer);
        }

        private updateUrl = () => {
            var path = this.zoom +
                "/" + this.latlng.lat.toFixed(HashService.PERSICION) +
                "/" + this.latlng.lng.toFixed(HashService.PERSICION);
            var searchObject = this.dataContainerToUrlString();
            this.$location.path(path);
            this.$location.search(searchObject);
            if (!this.$rootScope.$$phase) {
                this.$rootScope.$apply();
            }
        }

        public updateLocation = (latlng: L.LatLng, zoom: number) => {
            this.latlng.lat = latlng.lat;
            this.latlng.lng = latlng.lng;
            this.zoom = zoom;
            this.localStorageService.set(HashService.LATLNG_KEY, this.latlng);
            this.localStorageService.set(HashService.ZOOM_KEY, this.zoom);
            this.updateUrl();
        }

        public updateMarkers = (markers: Common.MarkerData[]) => {
            this.dataContainer.markers = markers;
            this.updateUrl();
        }

        public addRoute = (routeName: string) => {
            var routeInHash = _.find(this.dataContainer.routes, (routeToFind) => routeToFind.name == routeName);
            if (routeInHash != null) {
                return;
            }
            this.dataContainer.routes.push(<Common.RouteData> {
                name: routeName,
                segments: [],
            });
        }

        public updateRoute = (route: Common.RouteData) => {
            var routeInHash = _.find(this.dataContainer.routes, (routeToFind) => routeToFind.name == route.name);
            if (routeInHash == null) {
                return;
            }
            angular.copy(route, routeInHash);
            this.updateUrl();
        }

        public removeRoute = (routeName: string) => {
            _.remove(this.dataContainer.routes, (routeToRemove) => routeToRemove.name == routeName);
            this.updateUrl();
        }

        private routeToString = (routeData: Common.RouteData): string => {
            return this.routeSegmentsToString(routeData.segments);
        }

        private stringToRoute = (data: string, name: string): Common.RouteData => {
            return <Common.RouteData> {
                name: name,
                segments: this.stringToRouteSegments(data),
            };
        }

        private latlngsToStringArray(latlngs: L.LatLng[]): string[] {
            var array = <string[]>[];
            for (var latlngIndex = 0; latlngIndex < latlngs.length; latlngIndex++) {
                var latlng = latlngs[latlngIndex];
                array.push(latlng.lat.toFixed(HashService.PERSICION) + HashService.DATA_DELIMITER + latlng.lng.toFixed(HashService.PERSICION));
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
                var title = marker.title.replace(HashService.MARKER_SPECIAL_CHARACTERS_REGEXP, " ");
                array.push(marker.latlng.lat.toFixed(HashService.PERSICION) + HashService.DATA_DELIMITER + marker.latlng.lng.toFixed(HashService.PERSICION) + HashService.DATA_DELIMITER + title);
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

        private routeSegmentsToString(routeSegments: Common.RouteSegmentData[]): string {
            var array = [];
            for (var latlngIndex = 0; latlngIndex < routeSegments.length; latlngIndex++) {
                var pointSegment = routeSegments[latlngIndex];
                array.push(pointSegment.routingType + HashService.DATA_DELIMITER +
                    pointSegment.routePoint.lat.toFixed(HashService.PERSICION) +
                    HashService.DATA_DELIMITER +
                    pointSegment.routePoint.lng.toFixed(HashService.PERSICION));
            }
            return array.join(HashService.ARRAY_DELIMITER);
        }

        private stringToRouteSegments = (data: string): Common.RouteSegmentData[]=> {
            var splitted = data.split(HashService.SPILT_REGEXP);
            var array = <Common.RouteSegmentData[]>[];
            for (var pointIndex = 0; pointIndex < splitted.length; pointIndex++) {
                var pointStrings = splitted[pointIndex].split(HashService.DATA_DELIMITER);
                if (pointStrings.length == 3) {
                    array.push(<Common.RouteSegmentData> {
                        latlngzs: [],
                        routePoint: new L.LatLng(parseFloat(pointStrings[1]), parseFloat(pointStrings[2])),
                        routingType: pointStrings[0]
                    });
                }
            }
            return array;
        }

        private latlngToPointSegments(latlngs: L.LatLng[]): Common.RouteSegmentData[] {
            var array = <Common.RouteSegmentData[]>[];
            for (var latlngIndex = 0; latlngIndex < latlngs.length; latlngIndex++) {
                var latlng = latlngs[latlngIndex];
                array.push(<Common.RouteSegmentData> {
                    routePoint: latlng,
                    latlngzs: [],
                });
            }
            return array;
        }

        private dataContainerToUrlString = (): any => {
            var urlObject = {};
            urlObject[Common.Constants.MARKERS] = this.markersToStringArray(this.dataContainer.markers).join(HashService.ARRAY_DELIMITER);
            for (var routeIndex = 0; routeIndex < this.dataContainer.routes.length; routeIndex++) {
                var routeData = this.dataContainer.routes[routeIndex];
                urlObject[routeData.name.replace(" ", "_")] = this.routeToString(routeData);
            }
            return urlObject;
        }

        private urlStringToDataContainer(searchObject: any): Common.DataContainer {
            var data = <Common.DataContainer> {
                markers: [],
                routes: [],
            };
            if (!searchObject) {
                return data;
            }
            for (var parameter in searchObject) {
                if (parameter == Common.Constants.MARKERS) {
                    data.markers = this.stringArrayToMarkers(searchObject[parameter].split(HashService.SPILT_REGEXP) || [])
                    continue;
                }
                data.routes.push(this.stringToRoute(searchObject[parameter], parameter.replace("_", " ")));
            }

            return data;
        }

        private addDataFromUrl() {
            var path = this.$location.path();
            var splittedpath = path.split("/");
            var search = this.$location.search();
            this.searchTerm = search.q || "";
            this.externalUrl = search.url || "";

            if (splittedpath.length != 4) {
                // backwards compatibility... :-(
                var zoom = parseInt(this.getURLParameter("zoom"));
                var lat = parseFloat(this.getURLParameter("lat"));
                var lng = parseFloat(this.getURLParameter("lng"));
                if (zoom > 0 && lat > 0 && lng > 0) {
                    var href = window.location.pathname + "#/" + zoom + "/" + lat.toFixed(HashService.PERSICION) + "/" + lng.toFixed(HashService.PERSICION);
                    window.location.href = href;
                }
            } else {
                this.zoom = parseInt(splittedpath[splittedpath.length - 3]);
                this.latlng.lat = parseFloat(splittedpath[splittedpath.length - 2]);
                this.latlng.lng = parseFloat(splittedpath[splittedpath.length - 1]);
                this.dataContainer = this.urlStringToDataContainer(search);
            }
        }
        private getURLParameter(name) {
            return decodeURIComponent((new RegExp("[?|&]" + name + "=" + "([^&;]+?)(&|#|;|$)").exec(location.search) || [, ""])[1].replace(/\+/g, "%20")) || null;
        }
    }
} 