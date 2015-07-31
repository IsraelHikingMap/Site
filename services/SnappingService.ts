module IsraelHiking.Services {

    export class SnappingService extends ObjectWithMap {
        snappings: L.LayerGroup<L.GeoJSON>;

        constructor($http: angular.IHttpService,
            mapService: MapService) {
            super(mapService);

            this.snappings = L.layerGroup([]);
            this.map.addLayer(this.snappings);
            this.map.on("moveend", () => {
                if (this.map.getZoom() <= 12) {
                    this.snappings.clearLayers();
                    return;
                }

                var proxy = "http://www2.turistforeningen.no/routing.php?url=";
                var route = "http://www.openstreetmap.org/api/0.6/map";
                var params = "&bbox=" + this.map.getBounds().toBBoxString() + "&1=2";
                $http.get(proxy + route + params).success((osm: string) => {
                    this.snappings.clearLayers();
                    this.map.removeLayer(this.snappings);
                    var xml = (new DOMParser()).parseFromString(osm, "text/xml");
                    var layer = new (<any>L).OSM.DataLayer(xml, {
                        areaTags: [],
                        wayTags: ["highway"],
                        ignoreNode: true,
                        ignoreChangeSet: true,
                        styles: {
                            way: {
                                opacity: 1,
                                color: "red"
                            }
                        }
                    })
                    this.snappings = layer;
                    this.map.addLayer(this.snappings);
                });
            });
        }

        public snapTo = (latlng: L.LatLng): L.LatLng => {

            var sensitivity = 10;
            var minDist = Infinity;
            var minPoint = latlng;

            this.snappings.eachLayer((layer) => {
                if (layer instanceof L.Polyline == false) {
                    return;
                }
                var polyline = <L.Polyline><any>layer;
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