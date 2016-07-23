module IsraelHiking.Services.Layers.RouteLayers {
    export class RouteStateReadOnly extends RouteStateBase {
        constructor(context: RouteLayer) {
            super(context);
            this.initialize();
        }

        private createPoiMarker = (markerData: Common.MarkerData): IMarkerWithTitle => {
            let pathOptions = this.context.route.properties.pathOptions;
            var marker = L.marker(markerData.latlng, { draggable: false, clickable: true, riseOnHover: true, icon: IconsService.createMarkerIconWithColor(pathOptions.color), opacity: pathOptions.opacity} as L.MarkerOptions) as IMarkerWithTitle;
            marker.bindLabel(markerData.title, this.context.getBindLabelOptions());
            marker.title = markerData.title;
            marker.on("click", () => {
                marker.openPopup();
            });
            marker.addTo(this.context.map);
            if (!markerData.title) { // must be after adding to map
                marker.hideLabel();
            }
            return marker;
        }

        private createRouteMarker(markerData: Common.MarkerData): IMarkerWithTitle {
            let pathOptions = this.context.route.properties.pathOptions;
            let markerWithTitle = L.marker(markerData.latlng, { clickable: false, draggable: false, opacity: pathOptions.opacity, icon: IconsService.createHoverIcon(pathOptions.color) });
            this.context.map.addLayer(markerWithTitle);
            return markerWithTitle as IMarkerWithTitle;
        }

        private createPolyline(latlngzs: L.LatLng[]) {
            let polyline = L.polyline(latlngzs, this.context.route.properties.pathOptions);
            this.context.map.addLayer(polyline);
            return polyline;
        }

        public initialize() {
            for (let segment of this.context.route.segments) {
                segment.polyline = this.createPolyline(segment.latlngzs);
                segment.routePointMarker = segment.routePoint.title ? this.createPoiMarker(segment.routePoint) : this.createRouteMarker(segment.routePoint);
            }
            for (let marker of this.context.route.markers) {
                marker.marker = this.createPoiMarker(marker);
            }
        }

        public clear() {
            for (let segment of this.context.route.segments) {
                this.context.map.removeLayer(segment.polyline);
                this.context.map.removeLayer(segment.routePointMarker);
            }
            for (let marker of this.context.route.markers) {
                this.context.map.removeLayer(marker.marker);
            }
        }

        public getEditMode() {
            return EditMode.NONE;
        }
    }
}