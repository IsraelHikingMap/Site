namespace IsraelHiking.Services.Layers.RouteLayers {
    export class RouteStateReadOnly extends RouteStateBase {
        constructor(context: RouteLayer) {
            super(context);
            this.initialize();
        }

        private createPolyline(latlngzs: L.LatLng[]) {
            let polyline = L.polyline(latlngzs, this.context.route.properties.pathOptions);
            this.context.map.addLayer(polyline);
            return polyline;
        }

        public initialize() {
            for (let segment of this.context.route.segments) {
                segment.polyline = this.createPolyline(segment.latlngzs);
                segment.routePointMarker = null;
            }
        }

        public clear() {
            for (let segment of this.context.route.segments) {
                this.context.map.removeLayer(segment.polyline);
            }
        }

        public getEditMode() {
            return EditMode.NONE;
        }
    }
}