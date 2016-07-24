namespace IsraelHiking.Services.Layers.PoiLayers {
    export class HoverHandlerPoi implements RouteLayers.IHoverHandler {
        private context: PoiLayer;
        protected hoverMarker: L.Marker;
        protected hoverState: string;

        constructor(context: PoiLayer) {
            this.context = context;
            let pathOptions = this.context.pathOptions;
            this.hoverMarker = L.marker(this.context.map.getCenter(), { clickable: false, icon: IconsService.createMarkerIconWithColor(pathOptions.color), opacity: pathOptions.opacity } as L.MarkerOptions);
        }

        public getState = (): string => {
            return this.hoverState;
        }

        public setState = (state: string) => {
            if (this.hoverState === state) {
                return;
            }
            this.hoverState = state;
            switch (this.hoverState) {
                case RouteLayers.HoverHandlerBase.NONE:
                case RouteLayers.HoverHandlerBase.ON_MARKER:
                case RouteLayers.HoverHandlerBase.DRAGGING:
                    this.context.map.removeLayer(this.hoverMarker);
                break;
                case RouteLayers.HoverHandlerBase.ADD_POINT:
                    this.context.map.addLayer(this.hoverMarker);
                    break;
            }
        }

        public onMouseMove = (e: L.LeafletMouseEvent): void => {
            if (this.hoverState === RouteLayers.HoverHandlerBase.ON_MARKER ||
                this.hoverState === RouteLayers.HoverHandlerBase.DRAGGING) {
                return;
            }
            this.setState(RouteLayers.HoverHandlerBase.ADD_POINT);
            this.hoverMarker.setLatLng(e.latlng);
        }
    }
}