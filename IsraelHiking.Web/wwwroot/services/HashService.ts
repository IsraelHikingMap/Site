namespace IsraelHiking.Services {
    export class HashService extends ObjectWithMap {
        public static MARKERS = "markers";
        public static MAP_LOCATION_CHANGED = "mapLocationChanged";

        private static ARRAY_DELIMITER = ";";
        private static SPILT_REGEXP = /[:;]+/;
        private static MARKER_SPECIAL_CHARACTERS_REGEXP = /[:;,]+/;
        private static DATA_DELIMITER = ",";
        private static PERSICION = 4;
        private static BASE_LAYER = "baselayer";
        private static URL = "url";
        private static DOWNLOAD = "download";

        private $location: angular.ILocationService;
        private $rootScope: angular.IScope;
        private localStorageService: angular.local.storage.ILocalStorageService;
        private dataContainer: Common.DataContainer;
        private changingAddress: boolean;

        public searchTerm: string;
        public externalUrl: string;
        public siteUrl: string;
        public download: boolean;

        constructor($location: angular.ILocationService,
            $window: angular.IWindowService,
            $rootScope: angular.IScope,
            localStorageService: angular.local.storage.ILocalStorageService,
            mapService: MapService) {
            super(mapService);
            this.$location = $location;
            this.$rootScope = $rootScope;
            this.localStorageService = localStorageService;

            this.dataContainer = { routes: [] } as Common.DataContainer;
            this.searchTerm = "";
            this.changingAddress = false;
            this.addDataFromUrl();
            this.updateUrl();

            this.$rootScope.$on("$locationChangeSuccess", () => {
                if (this.changingAddress) {
                    this.changingAddress = false;
                    return;
                }
                let latLngZ = this.parsePathToGeoLocation();
                if (latLngZ == null) {
                    $window.location.href = this.$location.absUrl();
                    $window.location.reload();
                    return;
                }

                this.map.setZoom(latLngZ.z);
                this.map.panTo(latLngZ);
            });

            this.map.on("moveend", () => {
                this.updateUrl();
            });
        }

        public getDataContainer = (): Common.DataContainer => {
            return angular.copy(this.dataContainer);
        }

        private updateUrl = () => {
            var path = "/" + this.map.getZoom() +
                "/" + this.map.getCenter().lat.toFixed(HashService.PERSICION) +
                "/" + this.map.getCenter().lng.toFixed(HashService.PERSICION);
            this.changingAddress = this.$location.path() !== path;
            this.$location.path(path).replace();
            if (!this.$rootScope.$$phase) {
                this.$rootScope.$apply();
            }
        }

        public clear = () => {
            if (this.siteUrl) {
                this.$location.search({ s: this.siteUrl }).replace();
            } else {
                this.$location.search({}).replace();
            }

        }

        private stringToRoute = (data: string, name: string): Common.RouteData => {
            return {
                name: name,
                segments: this.stringToRouteSegments(data),
                markers: []
            } as Common.RouteData;
        }

        private stringArrayToMarkers(stringArray: string[]): Common.MarkerData[] {
            var array = [] as Common.MarkerData[];
            for (let srtingIndex = 0; srtingIndex < stringArray.length; srtingIndex++) {
                var markerStringSplit = stringArray[srtingIndex].split(HashService.DATA_DELIMITER);
                if (markerStringSplit.length < 2) {
                    continue;
                }
                let title = "";
                if (markerStringSplit.length >= 3) {
                    title = markerStringSplit[2];
                }
                array.push({
                    latlng: new L.LatLng(parseFloat(markerStringSplit[0]), parseFloat(markerStringSplit[1])),
                    title: title,
                    type: ""
                });
            }
            return array;
        }

        private stringToRouteSegments = (data: string): Common.RouteSegmentData[] => {
            var splitted = data.split(HashService.SPILT_REGEXP);
            var array = [] as Common.RouteSegmentData[];
            for (let pointIndex = 0; pointIndex < splitted.length; pointIndex++) {
                var pointStrings = splitted[pointIndex].split(HashService.DATA_DELIMITER);
                if (pointStrings.length === 3) {
                    array.push({
                        latlngzs: [],
                        routePoint: L.latLng(parseFloat(pointStrings[1]), parseFloat(pointStrings[2])),
                        routingType: this.convertCharacterToRoutingType(pointStrings[0])
                    } as Common.RouteSegmentData);
                }
            }
            return array;
        }

        private convertCharacterToRoutingType(routingTypeCharacter: string): Common.RoutingType {
            switch (routingTypeCharacter) {
                case "h":
                    return "Hike";
                case "b":
                    return "Bike";
                case "f":
                    return "4WD";
                case "n":
                    return "None";
                default:
                    return "Hike";
            }
        }

        private stringToBaseLayer(addressOrKey: string): Common.LayerData {
            if (addressOrKey.indexOf("www") !== -1 || addressOrKey.indexOf("http") !== -1) {
                return {
                    key: "",
                    address: addressOrKey
                } as Common.LayerData;
            }
            return {
                key: addressOrKey.split("_").join(" "),
                address: ""
            } as Common.LayerData;
        }

        private urlStringToDataContainer(searchObject: any): Common.DataContainer {
            let data = {
                routes: []
            } as Common.DataContainer;
            let markers = [];
            for (let parameter in searchObject) {
                if (searchObject.hasOwnProperty(parameter)) {
                    if (parameter.toLocaleLowerCase() === HashService.URL) {
                        continue;
                    }
                    if (parameter === HashService.MARKERS) {
                        markers = this.stringArrayToMarkers(searchObject[parameter].split(HashService.SPILT_REGEXP) || []);
                        continue;
                    }
                    if (parameter === HashService.BASE_LAYER) {
                        data.baseLayer = this.stringToBaseLayer(searchObject[parameter] || "");
                    }
                    if (parameter === "s") {
                        continue;
                    }
                    if (parameter === HashService.DOWNLOAD) {
                        continue;
                    }
                    data.routes.push(this.stringToRoute(searchObject[parameter], parameter.split("_").join(" ")));
                }
            }
            if (markers.length > 0) {
                if (data.routes.length === 0) {
                    let name = markers.length === 1 ? markers[0].title || HashService.MARKERS : HashService.MARKERS; 
                    data.routes.push({
                        name: name,
                        segments: [],
                        markers: []
                    });
                }
                data.routes[0].markers = markers;
            }
            return data;
        }

        private addDataFromUrl() {
            var search = this.$location.search();
            this.searchTerm = search.q || "";
            this.externalUrl = search.url || "";
            this.siteUrl = search.s || "";
            this.download = search.download ? true : false;
            let latLngZ = this.parsePathToGeoLocation();
            if (latLngZ != null) {
                this.map.setZoom(latLngZ.z);
                this.map.panTo(latLngZ);
            }
            this.dataContainer = this.urlStringToDataContainer(search);
        }

        private parsePathToGeoLocation(): Common.LatLngZ {
            var path = this.$location.path();
            var splittedpath = path.split("/");
            if (splittedpath.length !== 4) {
                return null;
            }
            return {
                z: parseInt(splittedpath[splittedpath.length - 3]),
                lat: parseFloat(splittedpath[splittedpath.length - 2]),
                lng: parseFloat(splittedpath[splittedpath.length - 1])
            } as Common.LatLngZ;
        }
    }
} 