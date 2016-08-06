namespace IsraelHiking.Services.Layers.PoiLayers {
    export class PoiStateReadOnly extends PoiStateBase {
        constructor(context: PoiLayer) {
            super(context);
            this.initialize();
        }

        public initialize() {
            for (let marker of this.context.markers) {
                marker.marker = this.createMarker(marker, false);
            }
        }

        public clear() {
            for (let marker of this.context.markers) {
                this.context.map.removeLayer(marker.marker);
            }
        }

        public getEditMode(): EditMode {
            return EditModeString.none;
        }
    }
}