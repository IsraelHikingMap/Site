module IsraelHiking.Services {
    export class HashService {
        private static ARRAY_DELIMITER = ":";
        private static DATA_DELIMITER = ",";
        private static PERSICION = 4;

        private $location: angular.ILocationService;
        private $rootScope: angular.IScope;
        private dataContainer: Common.DataContainer;
        public latlng: L.LatLng;
        public zoom: number;

        constructor($location: angular.ILocationService,
            $rootScope: angular.IScope) {
            this.$location = $location;
            this.$rootScope = $rootScope;
            this.latlng = new L.LatLng(31.773, 35.12);
            this.zoom = 13;
            this.dataContainer = <Common.DataContainer> { markers: [], routes: [] };
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
            this.updateUrl();
        }

        public updateMarkers = (markers: Common.MarkerData[]) => {
            this.dataContainer.markers = markers;
            this.updateUrl();
        }

        public addRoute = (routeName: string) => {
            var routeInHash = _.find(this.dataContainer.routes,(routeToFind) => routeToFind.name == routeName);
            if (routeInHash != null) {
                return;
            }
            this.dataContainer.routes.push(<Common.RouteData> {
                name: routeName,
                routingType: Common.routingType.none,
                segments: [],
            });
        }

        public updateRoute = (route: Common.RouteData) => {
            var routeInHash = _.find(this.dataContainer.routes,(routeToFind) => routeToFind.name == route.name);
            if (routeInHash == null) {
                return;
            }
            angular.copy(route, routeInHash);
            this.updateUrl();
        }

        public removeRoute = (routeName: string) => {
            _.remove(this.dataContainer.routes,(routeToRemove) => routeToRemove.name == routeName);
            this.updateUrl();
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
                var title = marker.title.replace(HashService.ARRAY_DELIMITER, " ").replace(HashService.DATA_DELIMITER, " ");
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
                    data.markers = this.stringArrayToMarkers(searchObject[parameter].split(HashService.ARRAY_DELIMITER) || [])
                    continue;
                }
                var routeData = this.stringToRoute(searchObject[parameter]);
                routeData.name = parameter.replace("_", " ");
                data.routes.push(routeData);
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
            if (splittedpath.length != 4) {
                // backwards compatibility... :-(
                zoom = parseInt(this.getURLParameter('zoom'));
                lat = parseFloat(this.getURLParameter('lat'));
                lng = parseFloat(this.getURLParameter('lng'));
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
            return decodeURIComponent((new RegExp('[?|&]' + name + '=' + '([^&;]+?)(&|#|;|$)').exec(location.search) || [, ""])[1].replace(/\+/g, '%20')) || null;
        }
    }
} 