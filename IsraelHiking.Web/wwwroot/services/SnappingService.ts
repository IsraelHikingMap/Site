namespace IsraelHiking.Services {

    export interface ISnappingOptions {
        layers: L.LayerGroup<L.Polyline>;
        sensitivity: number;
    }

    export interface ISnappingResponse {
        latlng: L.LatLng;
        polyline: L.Polyline;
        beforeIndex: number;
    }

    interface ISnappingRequestQueueItem {
        boundsString: string;
    }

    export class SnappingService extends ObjectWithMap {
        public snappings: L.LayerGroup<L.ILayer>;
        private $http: angular.IHttpService;
        private resourcesService: ResourcesService;
        private toastr: Toastr;
        private enabled: boolean;
        private requestsQueue: ISnappingRequestQueueItem[];

        constructor($http: angular.IHttpService,
            resourcesService: ResourcesService,
            mapService: MapService,
            toastr: Toastr) {
            super(mapService);

            this.$http = $http;
            this.resourcesService = resourcesService;
            this.snappings = L.layerGroup([]);
            this.map.addLayer(this.snappings);
            this.toastr = toastr;
            this.enabled = false;
            this.requestsQueue = [];
            this.map.on("moveend", () => {
                this.generateSnappings();
            });
        }

        private generateSnappings = () => {
            
            if (this.map.getZoom() <= 13 || this.enabled === false) {
                this.snappings.clearLayers();
                return;
            }
            
            var bounds = this.map.getBounds();
            var boundsString = [bounds.getSouthWest().lat, bounds.getSouthWest().lng, bounds.getNorthEast().lat, bounds.getNorthEast().lng].join(",");
            this.requestsQueue.push({
                boundsString: boundsString
            } as ISnappingRequestQueueItem);

            this.$http.get(Common.Urls.osm, {
                params: {
                    northEast: bounds.getNorthEast().lat + "," + bounds.getNorthEast().lng,
                    southWest: bounds.getSouthWest().lat + "," + bounds.getSouthWest().lng
                }
            }).then((features: { data: GeoJSON.Feature<GeoJSON.GeometryObject>[] }) => {
                let queueItem = _.find(this.requestsQueue, (itemToFind) => itemToFind.boundsString === boundsString);
                if (queueItem == null || this.requestsQueue.indexOf(queueItem) !== this.requestsQueue.length - 1) {
                    this.requestsQueue.splice(0, this.requestsQueue.length - 1);
                    return;
                }
                this.snappings.clearLayers();
                for (let feature of features.data) {
                    switch (feature.geometry.type) {
                    case Strings.GeoJson.lineString:
                        var lineString = feature.geometry as GeoJSON.LineString;
                        var latlngsArray = Services.Parsers.GeoJsonParser.createLatlngArray(lineString.coordinates);
                        this.snappings.addLayer(L.polyline(latlngsArray, { opacity: 0 } as L.PolylineOptions));
                        break;
                    case Strings.GeoJson.polygon:
                        var polygon = feature.geometry as GeoJSON.Polygon;
                        var polygonLatlngsArray = Services.Parsers.GeoJsonParser.createLatlngArray(polygon.coordinates[0]);
                        this.snappings.addLayer(L.polyline(polygonLatlngsArray, { opacity: 0 } as L.PolylineOptions));
                    }
                }

                this.requestsQueue.splice(0);
            }, () => {
                this.toastr.warning(this.resourcesService.unableToGetDataForSnapping);
                this.snappings.clearLayers();
            });
        }

        public snapTo = (latlng: L.LatLng, options?: ISnappingOptions): ISnappingResponse => {
            if (!options) {
                options = <ISnappingOptions> {
                    layers: this.snappings,
                    sensitivity: 10
                };
            }
            var minDistance = Infinity;
            var response = {
                latlng: latlng,
                polyline: null
            } as ISnappingResponse;

            options.layers.eachLayer((polyline) => {
                if (!(polyline instanceof L.Polyline)) {
                    return;
                }
                var latlngs = polyline.getLatLngs();
                if (latlngs.length <= 1) {
                    return;
                }

                var snapPoint = this.map.latLngToLayerPoint(latlng);
                var prevPoint = this.map.latLngToLayerPoint(latlngs[0]);
                var startDistance = snapPoint.distanceTo(prevPoint);

                if (startDistance <= options.sensitivity && startDistance < minDistance) {
                    minDistance = startDistance;
                    response.latlng = latlngs[0];
                    response.polyline = polyline;
                    response.beforeIndex = 0;
                }

                for (let latlngIndex = 1; latlngIndex < latlngs.length; latlngIndex++) {
                    var currentPoint = this.map.latLngToLayerPoint(latlngs[latlngIndex]);

                    var currentDistance = L.LineUtil.pointToSegmentDistance(snapPoint, prevPoint, currentPoint);
                    if (currentDistance < minDistance && currentDistance <= options.sensitivity) {
                        minDistance = currentDistance;
                        response.latlng = this.map.layerPointToLatLng(L.LineUtil.closestPointOnSegment(snapPoint, prevPoint, currentPoint));
                        response.polyline = polyline;
                        response.beforeIndex = latlngIndex - 1;
                    }
                    prevPoint = currentPoint;
                }
            });

            return response;
        }

        public enable = (enable: boolean) => {
            this.enabled = enable;
            if (this.enabled) {
                this.generateSnappings();
            }
        }

        public isEnabled = (): boolean => {
            return this.enabled;
        } 
    }
} 