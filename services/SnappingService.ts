module IsraelHiking.Services {

    export class SnappingService extends ObjectWithMap {
        snappings: L.LayerGroup<L.Polyline>;
        $http: angular.IHttpService;
        osmParser: Parsers.IParser;

        constructor($http: angular.IHttpService,
            mapService: MapService,
            parserFactory: Parsers.ParserFactory) {
            super(mapService);

            this.$http = $http;
            this.osmParser = parserFactory.Create(Parsers.ParserType.osm);
            this.snappings = L.layerGroup([]);
            this.map.addLayer(this.snappings);
            this.generateSnappings();
            this.map.on("moveend", () => {
                this.generateSnappings();
            });
        }

        private generateSnappings = () => {
            if (this.map.getZoom() <= 12) {
                this.snappings.clearLayers();
                return;
            }
            
            this.snappings.clearLayers();
            var bounds = this.map.getBounds();
            var boundsString = [bounds.getSouthWest().lat, bounds.getSouthWest().lng, bounds.getNorthEast().lat, bounds.getNorthEast().lng].join(",");
            var address = "http://overpass-api.de/api/interpreter?data=%28way[%22highway%22]%28" + boundsString + "%29;%3E;%29;out;";
            this.$http.get(address).success((osm: string) => {
                var data = this.osmParser.parse(osm);
                for (var routeIndex = 0; routeIndex < data.routes.length; routeIndex++) {
                    var route = data.routes[routeIndex];
                    for (var segmentIndex = 0; segmentIndex < route.segments.length; segmentIndex++) {
                        var segment = route.segments[segmentIndex];
                        if (segment.latlngs.length < 2) {
                            continue;
                        }
                        this.snappings.addLayer(L.polyline(segment.latlngs, <L.PolylineOptions> { opacity: 0 }));
                    }
                }
            });
        }

        public snapTo = (latlng: L.LatLng): L.LatLng => {
            var sensitivity = 10;
            var minDist = Infinity;
            var minPoint = latlng;

            this.snappings.eachLayer((polyline) => {
                var latlngs = polyline.getLatLngs();
                if (latlngs.length <= 0) {
                    return;
                }

                var snapPoint = this.map.latLngToLayerPoint(latlng);
                var prevPoint = this.map.latLngToLayerPoint(latlngs[0]);
                var startDistance = snapPoint.distanceTo(prevPoint);

                if (startDistance <= sensitivity && startDistance < minDist) {
                    minDist = startDistance;
                    minPoint = latlngs[0];
                }

                for (var latlngIndex = 1; latlngIndex < latlngs.length; latlngIndex++) {
                    var currentPoint = this.map.latLngToLayerPoint(latlngs[latlngIndex]);

                    var currentDistance = L.LineUtil.pointToSegmentDistance(snapPoint, prevPoint, currentPoint);
                    if (currentDistance < minDist && currentDistance <= sensitivity) {
                        minDist = currentDistance;
                        minPoint = this.map.layerPointToLatLng(L.LineUtil.closestPointOnSegment(snapPoint, prevPoint, currentPoint));

                    }
                    prevPoint = currentPoint;
                }
            });

            return minPoint;
        }
    }
} 