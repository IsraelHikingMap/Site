namespace IsraelHiking.Services.Layers.RouteLayers {
    export abstract class RouteStateBase {
        protected context: RouteLayer;

        constructor(context: RouteLayer) {
            this.context = context;
        }

        public abstract initialize(): void;
        public abstract clear(): void;
        public abstract getEditMode(): EditMode;

        public reRoute = (): void => { } // does nothing if not overriden

        public setHiddenState(): void {
            this.context.clearCurrentState();
            this.context.setState(new RouteStateHidden(this.context));
        }

        public setReadOnlyState(): void {
            this.context.clearCurrentState();
            this.context.setState(new RouteStateReadOnly(this.context));
        }

        public setEditRouteState(): void {
            this.context.clearCurrentState();
            this.context.setState(new RouteStateEditRoute(this.context));
        }

        public setEditPoiState(): void {
            this.context.clearCurrentState();
            this.context.setState(new RouteStateEditPoi(this.context));
        }

        protected createPoiMarker = (markerData: Common.MarkerData, isEditable: boolean): IMarkerWithTitle => {
            let pathOptions = this.context.route.properties.pathOptions;
            let marker = L.marker(markerData.latlng,
            {
                draggable: isEditable,
                clickable: isEditable,
                riseOnHover: true,
                icon: IconsService.createMarkerIconWithColorAndType(pathOptions.color, markerData.type),
                opacity: pathOptions.opacity
            } as L.MarkerOptions) as IMarkerWithTitle;
            marker.title = markerData.title || "";
            let colorName = this.context.getColorName();
            marker.bindLabel(this.context.getHtmlTitle(marker.title), { noHide: true, className: `marker-label fg-${colorName}` } as L.LabelOptions);
            marker.addTo(this.context.map);
            if (!marker.title) { // must be after adding to map...
                marker.hideLabel();
            }
            return marker;
        }
    }
}