namespace IsraelHiking.Services.Layers.PoiLayers {
    export class PoiStateReadOnly extends PoiStateBase {
        constructor(context: PoiLayer) {
            super(context);
            this.initialize();
        }

        private createPoiMarker = (markerData: Common.MarkerData): IMarkerWithTitle => {
            let pathOptions = this.context.pathOptions;
            var marker = L.marker(markerData.latlng, { draggable: false, clickable: true, riseOnHover: true, icon: IconsService.createMarkerIconWithColor(pathOptions.color), opacity: pathOptions.opacity } as L.MarkerOptions) as IMarkerWithTitle;
            marker.bindLabel(markerData.title, this.context.getBindLabelOptions());
            marker.title = markerData.title;
            marker.addTo(this.context.map);
            if (!markerData.title) { // must be after adding to map
                marker.hideLabel();
            }
            return marker;
        }

        public initialize() {
            for (let marker of this.context.markers) {
                marker.marker = this.createPoiMarker(marker);
            }
        }

        public clear() {
            for (let marker of this.context.markers) {
                this.context.map.removeLayer(marker.marker);
            }
        }

        public getEditMode() {
            return EditMode.NONE;
        }
    }
}