module IsraelHiking.Services {
    interface IUrlSerachObject {
        routePoints: string;
        markers: string;
        routingType: string;
    }

    export class HashService extends ObjectWithMap {
        $location: angular.ILocationService;
        $rootScope: angular.IScope;
        drawingRouteService: DrawingRouteService;
        drawingMarkerService: DrawingMarkerService;

        private static ARRAY_DELIMITER = ":";
        private static DATA_DELIMITER = ",";

        constructor($location: angular.ILocationService,
            $rootScope: angular.IScope,
            mapSerivce: MapService,
            drawingRouteService: DrawingRouteService,
            drawingMarkerService: DrawingMarkerService) {
            super(mapSerivce);
            this.$location = $location;
            this.$rootScope = $rootScope;
            this.drawingRouteService = drawingRouteService;
            this.drawingMarkerService = drawingMarkerService;
            this.addDataFromUrl();
            this.drawingRouteService.eventHelper.addListener((data) => {
                this.updateHashEventHandler();
            });
            this.drawingMarkerService.eventHelper.addListener((data) => {
                this.updateHashEventHandler();
            });
            this.map.on("moveend",(e: L.LeafletEvent) => {
                this.updateHashEventHandler();
                this.$rootScope.$apply();
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

            var routeData = this.drawingRouteService.getData();
            var routingType = this.drawingRouteService.getRoutingType();
            var markers = this.drawingMarkerService.getData();
            return <IUrlSerachObject> {
                routePoints: this.latlngsToStringArray(this.pointSegmentsToLatlng(routeData.segments)).join(HashService.ARRAY_DELIMITER),
                markers: this.markersToStringArray(markers).join(HashService.ARRAY_DELIMITER),
                routingType: routingType,
            };
        }

        private urlStringToDataContainer(searchObject: IUrlSerachObject): Common.DataContainer {
            var data = <Common.DataContainer> {
                markers: [],
                routeData: {
                    segments: [],
                    routingType: Common.routingType.none
                },
            };
            if (!searchObject) {
                return data;
            }
            if (searchObject.routingType != undefined) {
                data.routeData.routingType = searchObject.routingType
            }
            if (searchObject.routePoints != undefined) {
                data.routeData.segments = this.latlngToPointSegments(this.stringArrayToLatlngs(searchObject.routePoints.split(HashService.ARRAY_DELIMITER) || []));
            }
            if (searchObject.markers != undefined) {
                data.markers = this.stringArrayToMarkers(searchObject.markers.split(HashService.ARRAY_DELIMITER) || [])
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
                zoom = parseInt(splittedpath[splittedpath.length - 3]);
                lat = parseFloat(splittedpath[splittedpath.length - 2]);
                lng = parseFloat(splittedpath[splittedpath.length - 1]);
                var data = this.urlStringToDataContainer(search);
                this.drawingRouteService.setData(data.routeData);
                this.drawingMarkerService.setData(data.markers);
                this.drawingRouteService.changeRoutingType(data.routeData.routingType);
                this.updateHash(lat, lng, zoom);
                this.map.panTo([lat, lng]);
                this.map.setZoom(zoom);
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