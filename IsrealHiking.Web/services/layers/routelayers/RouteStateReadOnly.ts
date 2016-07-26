declare namespace L {
    function polylineDecorator(p: Polyline, options?: any): Polyline;
    namespace Symbol {
        function arrowHead(options: any): any;
    }
}

namespace IsraelHiking.Services.Layers.RouteLayers {
    export class RouteStateReadOnly extends RouteStateBase {
        private arrows: L.LayerGroup<L.Polyline>;

        constructor(context: RouteLayer) {
            super(context);
            this.arrows = L.layerGroup([]);
            this.initialize();
        }

        private createPolyline(latlngzs: L.LatLng[]) {
            let pathOptions = this.context.route.properties.pathOptions;
            let polyline = L.polyline(latlngzs, pathOptions);
            if (latlngzs.length > 2 || !latlngzs[0].equals(latlngzs[1])) {
                var arrow = L.polylineDecorator(polyline, {
                    patterns: [{
                        repeat: 100,
                        symbol: L.Symbol.arrowHead({ pixelSize: 10, polygon: false, pathOptions: pathOptions })
                    }]
                });
                this.arrows.addLayer(arrow);    
            }
            this.context.map.addLayer(polyline);
            return polyline;
        }

        public initialize() {
            this.context.map.addLayer(this.arrows);
            this.arrows.clearLayers();
            for (let segment of this.context.route.segments) {
                segment.polyline = this.createPolyline(segment.latlngzs);
                segment.routePointMarker = null;
            }
        }

        public clear() {
            for (let segment of this.context.route.segments) {
                this.context.map.removeLayer(segment.polyline);
            }
            this.arrows.clearLayers();
            this.context.map.removeLayer(this.arrows);
        }

        public getEditMode() {
            return EditMode.NONE;
        }
    }
}