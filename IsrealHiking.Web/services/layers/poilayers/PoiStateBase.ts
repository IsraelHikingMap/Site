namespace IsraelHiking.Services.Layers.PoiLayers {

    export abstract class PoiStateBase {
        protected context: PoiLayer;

        constructor(context: PoiLayer) {
            this.context = context;
        }

        public abstract initialize(): void;
        public abstract clear(): void;
        public abstract getEditMode(): EditMode;

        public setReadOnlyState(): void {
            this.context.clearCurrentState();
            this.context.setState(new PoiStateReadOnly(this.context));
        }

        public setEditState(): void {
            this.context.clearCurrentState();
            this.context.setState(new PoiStateEdit(this.context));
        }

        protected createMarker = (markerData: Common.MarkerData, isEditable: boolean): IMarkerWithTitle => {
            let pathOptions = this.context.pathOptions;
            let marker = L.marker(markerData.latlng, { draggable: isEditable, clickable: isEditable, riseOnHover: true, icon: IconsService.createMarkerIconWithColor(pathOptions.color), opacity: pathOptions.opacity } as L.MarkerOptions) as IMarkerWithTitle;
            marker.title = markerData.title || "";
            marker.bindLabel(this.context.getHtmlTitle(marker.title), { noHide: true, className: "marker-label" } as L.LabelOptions);
            marker.addTo(this.context.map);
            if (!marker.title) { // must be after adding to map...
                marker.hideLabel();
            }
            return marker;
        }
    }
}