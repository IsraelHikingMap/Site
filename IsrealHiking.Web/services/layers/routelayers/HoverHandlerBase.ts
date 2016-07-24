namespace IsraelHiking.Services.Layers.RouteLayers {

    export interface IHoverHandler {
        getState: () => string;
        setState: (state: string) => void;
        onMouseMove: (e: L.LeafletMouseEvent) => void;
    }

    export abstract class HoverHandlerBase {
        protected middleMarker: L.Marker;
        protected hoverMarker: L.Marker;
        protected hoverState: string;
        protected context: RouteLayer;

        public static NONE = "none";
        public static ADD_POINT = "addPoint";
        public static ON_MARKER = "onMarker";
        public static ON_POLYLINE = "onPolyline";
        public static DRAGGING = "dragging";

        constructor(context: RouteLayer, middleMarker: L.Marker) {
            this.context = context;
            let pathOptions = this.context.route.properties.pathOptions;
            this.hoverMarker = L.marker(this.context.map.getCenter(), { clickable: false, icon: IconsService.createMarkerIconWithColor(pathOptions.color), opacity: pathOptions.opacity} as L.MarkerOptions);
            this.middleMarker = middleMarker;
        }

        public getState = (): string => {
            return this.hoverState;
        }
    }
}