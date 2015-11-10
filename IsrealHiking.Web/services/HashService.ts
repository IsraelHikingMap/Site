module IsraelHiking.Services {
    export class HashService {
        private static ZOOM_KEY = "Zoom";
        private static LATLNG_KEY = "LatLng";
        private static ARRAY_DELIMITER = ";";
        private static SPILT_REGEXP = /[:;]+/;
        private static MARKER_SPECIAL_CHARACTERS_REGEXP = /[:;,]+/;
        private static DATA_DELIMITER = ",";
        private static PERSICION = 4;
        private static BASE_LAYER = "baselayer";

        private $location: angular.ILocationService;
        private $rootScope: angular.IScope;
        private localStorageService: angular.local.storage.ILocalStorageService;
        private dataContainer: Common.DataContainer;

        public latlng: L.LatLng;
        public zoom: number;
        public searchTerm: string;
        public externalUrl: string;
        public siteUrl: string;

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
            this.updateUrl();
        }

        public getDataContainer = (): Common.DataContainer => {
            return angular.copy(this.dataContainer);
        }

        private updateUrl = () => {
            var path = this.zoom +
                "/" + this.latlng.lat.toFixed(HashService.PERSICION) +
                "/" + this.latlng.lng.toFixed(HashService.PERSICION);
            this.$location.path(path);
            if (!this.$rootScope.$$phase) {
                this.$rootScope.$apply();
            }
        }

        public clear = () => {
            if (this.siteUrl) {
                this.$location.search({ s: this.siteUrl });
            } else {
                this.$location.search({});
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

        private stringToRoute = (data: string, name: string): Common.RouteData => {
            return <Common.RouteData> {
                name: name,
                segments: this.stringToRouteSegments(data),
            };
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

        private stringToBaseLayer(addressOrKey: string): Common.LayerData {
            if (addressOrKey.indexOf("www") != -1 || addressOrKey.indexOf("http") != -1) {
                return <Common.LayerData>{
                    key: "",
                    address: addressOrKey,
                };
            }
            return <Common.LayerData>{
                key: addressOrKey.split("_").join(" "),
                address: "",
            };
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
                if (parameter == HashService.BASE_LAYER) {
                    data.baseLayer = this.stringToBaseLayer(searchObject[parameter] || "");
                }
                if (parameter == "s") {
                    continue;
                }
                data.routes.push(this.stringToRoute(searchObject[parameter], parameter.split("_").join(" ")));
            }
            return data;
        }

        private addDataFromUrl() {
            var path = this.$location.path();
            var splittedpath = path.split("/");
            var search = this.$location.search();
            this.searchTerm = search.q || "";
            this.externalUrl = search.url || "";
            this.siteUrl = search.s || "";
            if (splittedpath.length == 4) {
                this.zoom = parseInt(splittedpath[splittedpath.length - 3]);
                this.latlng.lat = parseFloat(splittedpath[splittedpath.length - 2]);
                this.latlng.lng = parseFloat(splittedpath[splittedpath.length - 1]);
            }
            this.dataContainer = this.urlStringToDataContainer(search);
        }
    }
} 