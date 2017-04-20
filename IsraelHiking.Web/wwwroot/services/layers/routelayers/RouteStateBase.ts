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

        protected createPoiMarker = (markerData: Common.MarkerData, isEditable: boolean): Common.IMarkerWithTitle => {
            let pathOptions = this.context.route.properties.pathOptions;
            let marker = L.marker(markerData.latlng,
            {
                draggable: isEditable,
                clickable: isEditable,
                keyboard: false,
                riseOnHover: true,
                icon: IconsService.createMarkerIconWithColorAndType(pathOptions.color, markerData.type),
                opacity: pathOptions.opacity
            } as L.MarkerOptions) as Common.IMarkerWithTitle;
            let color = this.context.getRouteProperties().pathOptions.color;
            Services.MapService.setMarkerTitle(marker, markerData.title, color);
            marker.addTo(this.context.map);
            return marker;
        }
    }
}