module IsraelHiking.Services {

    export interface ISnappingOptions {
        layers: L.LayerGroup<L.Polyline>;
        sensitivity: number;
    }

    export interface ISnappingResponse {
        latlng: L.LatLng;
        polyline: L.Polyline;
        beforeIndex: number;
    }

    export class SnappingService extends ObjectWithMap {
        snappings: L.LayerGroup<L.Polyline>;
        $http: angular.IHttpService;
        osmParser: Parsers.IParser;
        toastr: Toastr;

        constructor($http: angular.IHttpService,
            mapService: MapService,
            parserFactory: Parsers.ParserFactory,
            toastr: Toastr) {
            super(mapService);

            this.$http = $http;
            this.osmParser = parserFactory.create(Parsers.ParserType.osm);
            this.snappings = L.layerGroup([]);
            this.map.addLayer(this.snappings);
            this.generateSnappings();
            this.toastr = toastr;
            this.map.on("moveend", () => {
                this.generateSnappings();
            });
        }

        private generateSnappings = () => {
            this.snappings.clearLayers();
            if (this.map.getZoom() <= 13) {
                return;
            }
            
            var bounds = this.map.getBounds();
            var boundsString = [bounds.getSouthWest().lat, bounds.getSouthWest().lng, bounds.getNorthEast().lat, bounds.getNorthEast().lng].join(",");
            this.$http.get(Common.Urls.overpass, {
                params: {
                    data: `(way["highway"](${boundsString});>;);out;`
                }
            }).success((osm: string) => {
                var data = this.osmParser.parse(osm);
                for (let route of data.routes) {
                    for (let segment of route.segments) {
                        if (segment.latlngzs.length < 2 ||
                            (segment.latlngzs.length === 2 && segment.latlngzs[0].equals(segment.latlngzs[1]))) {
                            continue;
                        }
                        this.snappings.addLayer(L.polyline(segment.latlngzs, { opacity: 0 } as L.PolylineOptions));
                    }
                }
            }).error(() => {
                this.toastr.error("Unable to get overpass data for snapping...");
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
    }
} 