namespace IsraelHiking.Services.Layers.RouteLayers {
    export class RouteStateEditPoi extends RouteStateEditBase {
        constructor(context: RouteLayer) {
            super(context);
            this.hoverHandler = new HoverHandlerPoi(context, this.createMiddleMarker());
            this.initialize();
        }

        protected addPoint(e: L.LeafletMouseEvent) {
            let marker = this.createMarker({ latlng: e.latlng } as Common.MarkerData, false);
            this.context.route.markers.push({
                latlng: e.latlng,
                marker: marker,
                title: ""
            });
            this.context.$timeout(() =>  marker.openPopup(), 200);
            this.context.dataChanged();
        }

        public getEditMode() {
            return EditMode.POI;
        }
    }
}