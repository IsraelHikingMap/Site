namespace IsraelHiking.Services.Layers.RouteLayers {
    export class HoverHandlerRoute extends HoverHandlerBase implements IHoverHandler {
        private hoverPolyline: L.Polyline;

        constructor(context: RouteLayer, middleMarker: L.Marker) {
            super(context, middleMarker);
            this.hoverPolyline = L.polyline([]);
            this.hoverPolyline.setStyle(angular.extend({ dashArray: "10, 10" }, this.context.route.properties.pathOptions) as L.PolylineOptions);
            this.setState(HoverHandlerBase.NONE);
        }

        public setState = (state: string) => {
            if (this.hoverState === state) {
                return;
            }
            this.hoverState = state;
            switch (this.hoverState) {
            case HoverHandlerBase.NONE:
            case HoverHandlerBase.ON_MARKER:
                this.context.map.removeLayer(this.hoverPolyline);
                this.context.map.removeLayer(this.hoverMarker);
                this.context.map.removeLayer(this.middleMarker);
                break;
            case HoverHandlerBase.ON_POLYLINE:
            case HoverHandlerBase.DRAGGING:
                this.context.map.removeLayer(this.hoverPolyline);
                this.context.map.removeLayer(this.hoverMarker);
                this.context.map.addLayer(this.middleMarker);
                break;
            case HoverHandlerBase.ADD_POINT:
                this.context.map.addLayer(this.hoverPolyline);
                this.context.map.addLayer(this.hoverMarker);
                this.context.map.removeLayer(this.middleMarker);
                break;
            }
        }

        public onMouseMove = (e: L.LeafletMouseEvent): void => {
            if (this.hoverState === HoverHandlerBase.ON_MARKER ||
                this.hoverState === HoverHandlerBase.DRAGGING) {
                return;
            }
            let snapToResponse = this.context.snapToRoute(e.latlng);
            if (snapToResponse.polyline != null) {
                this.setState(HoverHandlerBase.ON_POLYLINE);
                this.middleMarker.setOpacity(1.0);
                this.middleMarker.setLatLng(snapToResponse.latlng);
                return;
            }

            this.middleMarker.setOpacity(0.0);
            this.setState(HoverHandlerBase.ADD_POINT);
            snapToResponse = this.context.snappingService.snapTo(e.latlng);
            this.hoverMarker.setLatLng(snapToResponse.latlng);
            var hoverStartPoint = this.context.route.segments.length > 0
                ? this.context.route.segments[this.context.route.segments.length - 1].routePoint
                : snapToResponse.latlng;
            this.hoverPolyline.setLatLngs([hoverStartPoint, snapToResponse.latlng]);
        }
    }
}