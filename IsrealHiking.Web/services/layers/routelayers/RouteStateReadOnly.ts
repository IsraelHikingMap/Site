declare namespace L {
    function polylineDecorator(p: Polyline, options?: any): Polyline;
    interface AntPathOptions extends PolylineOptions {
        delay?: string;
        pulseColor?: string;
        paused?: boolean;
    }
    namespace polyline {
        function antPath(latlngs: LatLng[], options: AntPathOptions): L.Polyline;
    }
    namespace Symbol {
        function arrowHead(options: any): any;
    }
}

namespace IsraelHiking.Services.Layers.RouteLayers {
    export class RouteStateReadOnly extends RouteStateBase {
        private readOnlyLayers: L.LayerGroup<L.ILayer>;

        constructor(context: RouteLayer) {
            super(context);
            this.readOnlyLayers = L.layerGroup([]);
            this.initialize();
        }

        private createPolyline(latlngzs: L.LatLng[]) {
            let routePathOptions = this.context.route.properties.pathOptions;
            if (this.context.route.properties.name.indexOf("AntPath") !== -1) {
                let pathOptions = { delay: "2000", pulseColor: routePathOptions.color, dashArray: "30 10", opacity: routePathOptions.opacity, color: "transparent", weight: routePathOptions.weight } as L.AntPathOptions;
                let polyline = L.polyline.antPath(latlngzs, pathOptions);
                this.context.map.addLayer(polyline);
                return polyline;
            }
            let polyline = L.polyline(latlngzs, routePathOptions);
            if (latlngzs.length > 2 || !latlngzs[0].equals(latlngzs[1])) {
                var arrow = L.polylineDecorator(polyline, {
                    patterns: [{
                        repeat: 100,
                        symbol: L.Symbol.arrowHead({ pixelSize: 10, polygon: false, pathOptions: { color: "black", opacity: routePathOptions.opacity, weight: 3 } as L.PathOptions })
                    }]
                });
                this.readOnlyLayers.addLayer(arrow);
            }
            this.context.map.addLayer(polyline);
            return polyline;
        }

        private createStartAndEndMarkers() {
            let startLatLng = this.context.route.segments[0].latlngzs[0];
            let lastSegmentLatLngs = this.context.route.segments[this.context.route.segments.length - 1].latlngzs;
            let endLatLng = lastSegmentLatLngs[lastSegmentLatLngs.length - 1];
            let pathOptions = this.context.route.properties.pathOptions;
            this.readOnlyLayers.addLayer(L.marker(startLatLng,
                {
                    opacity: pathOptions.opacity,
                    draggable: false,
                    clickable: false,
                    icon: IconsService.createRoundIcon("green")
                }));
            this.readOnlyLayers.addLayer(L.marker(endLatLng,
                {
                    opacity: pathOptions.opacity,
                    draggable: false,
                    clickable: false,
                    icon: IconsService.createRoundIcon("red")
                }));
        }

        public initialize() {
            this.context.map.addLayer(this.readOnlyLayers);
            this.readOnlyLayers.clearLayers();
            if (this.context.route.segments.length <= 0) {
                return;
            }
            this.createStartAndEndMarkers();
            for (let segment of this.context.route.segments) {
                segment.polyline = this.createPolyline(segment.latlngzs);
                segment.routePointMarker = null;
            }
        }

        public clear() {
            for (let segment of this.context.route.segments) {
                this.context.map.removeLayer(segment.polyline);
            }
            this.readOnlyLayers.clearLayers();
            this.context.map.removeLayer(this.readOnlyLayers);
        }

        public getEditMode(): EditMode {
            return EditModeString.none;
        }
    }
}