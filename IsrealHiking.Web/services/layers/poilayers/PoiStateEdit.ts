namespace IsraelHiking.Services.Layers.PoiLayers {
    export class PoiStateEdit extends PoiStateBase {
        protected hoverHandler: RouteLayers.IHoverHandler;

        constructor(context: PoiLayer) {
            super(context);
            this.hoverHandler = new HoverHandlerPoi(this.context);
            this.initialize();
        }

        protected addPoint(e: L.LeafletMouseEvent) {
            let marker = this.createMarkerWithEvents({ latlng: e.latlng, title: "" } as Common.MarkerData);
            this.context.markers.push({
                latlng: e.latlng,
                marker: marker,
                title: ""
            });
            this.context.$timeout(() => marker.openPopup(), 200);
            this.context.dataChanged();
        }

        public getEditMode(): EditMode {
            return EditModeString.poi;
        }

        private createMarkerWithEvents(markerData: Common.MarkerData): IMarkerWithTitle {
            let marker = this.createMarker(markerData, true);
            var newScope = this.context.$rootScope.$new() as Controllers.IMarkerPopupScope;
            newScope.marker = marker;
            newScope.poiLayer = this.context;
            this.setPoiMarkerEvents(marker);
            newScope.remove = () => {
                let routeMarker = _.find(this.context.markers, markerToFind => markerToFind.marker === marker);
                this.removePoi(routeMarker);
            }
            let popupHtml = this.context.$compile("<div marker-popup></div>")(newScope)[0];
            marker.bindPopup(popupHtml);
            return marker;
        }

        private setPoiMarkerEvents(marker: L.Marker) {
            marker.on("dragstart", () => {
                marker.closePopup();
                this.hoverHandler.setState(RouteLayers.HoverHandlerBase.DRAGGING);
            });
            marker.on("dragend", () => {
                let markerInArray = _.find(this.context.markers, markerToFind => markerToFind.marker === marker);
                markerInArray.latlng = marker.getLatLng();
                this.context.dataChanged();
            });
            marker.on("mouseover", () => {
                if (this.hoverHandler.getState() !== RouteLayers.HoverHandlerBase.DRAGGING) {
                    this.hoverHandler.setState(RouteLayers.HoverHandlerBase.ON_MARKER);
                }
            });
            marker.on("mouseout", () => {
                if (this.hoverHandler.getState() !== RouteLayers.HoverHandlerBase.DRAGGING) {
                    this.hoverHandler.setState(RouteLayers.HoverHandlerBase.NONE);
                }
            });
        }

        private removePoi = (poi: IMarkerWithData) => {
            let poiToRemove = _.find(this.context.markers, markerToFind => markerToFind === poi);
            this.context.markers.splice(this.context.markers.indexOf(poiToRemove), 1);
            this.destoryMarker(poiToRemove.marker);
        }

        public initialize() {
            this.context.map.on("click", this.addPoint, this);
            this.context.map.on("mousemove", this.hoverHandler.onMouseMove, this.hoverHandler);

            for (let marker of this.context.markers) {
                marker.marker = this.createMarkerWithEvents(marker);
            }
        }

        public clear() {
            for (let marker of this.context.markers) {
                this.context.map.removeLayer(marker.marker);
            }
            this.context.map.off("mousemove", this.hoverHandler.onMouseMove, this.hoverHandler);
            this.context.map.off("click", this.addPoint, this);
            this.hoverHandler.setState(RouteLayers.HoverHandlerBase.NONE);
        }

        private destoryMarker = (marker: L.Marker) => {
            if (marker == null) {
                return;
            }
            marker.closePopup();
            marker.off("click");
            marker.off("dragstart");
            marker.off("drag");
            marker.off("dragend");
            marker.off("mouseover");
            marker.off("mouseout");
            marker.off("dblclick");
            marker.off("popupopen");
            marker.off("popupclose");
            this.context.map.removeLayer(marker);
            this.hoverHandler.setState(RouteLayers.HoverHandlerBase.NONE);
        }
    }
}