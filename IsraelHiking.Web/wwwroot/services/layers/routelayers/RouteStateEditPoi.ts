namespace IsraelHiking.Services.Layers.RouteLayers {

    export class RouteStateEditPoi extends RouteStateEdit {
        constructor(context: RouteLayers.RouteLayer) {
            super(context);
            this.hoverHandler.setRouteHover(false);
        }

        protected addPoint(e: L.MouseEvent) {
            let marker = this.createPoiMarkerWithEvents({ latlng: e.latlng, title: "" } as Common.MarkerData);
            this.context.route.markers.push({
                latlng: e.latlng,
                marker: marker,
                title: "",
                type: ""
            });
            this.context.$timeout(() => marker.openPopup(), 200);
            this.context.dataChanged();
        }

        public getEditMode(): EditMode {
            return EditModeString.poi;
        }
    }
}