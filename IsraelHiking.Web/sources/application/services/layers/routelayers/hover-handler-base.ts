import * as L from "leaflet";

import { IRouteLayer } from "./iroute.layer";

export class HoverHandlerState {
    public static readonly NONE = "none";
    public static readonly ADD_POINT = "addPoint";
    public static readonly ON_MARKER = "onMarker";
    public static readonly ON_POLYLINE = "onPolyline";
    public static readonly DRAGGING = "dragging";
}

export abstract class HoverHandlerBase {

    public hoverMarker: L.Marker;
    protected hoverState: string;

    public abstract onMouseMove: (e: L.LeafletMouseEvent) => void;

    constructor(protected context: IRouteLayer) {
        let pathOptions = this.context.route.properties.pathOptions;
        this.hoverMarker = L.marker(this.context.mapService.map.getCenter(),
            {
                clickable: false,
                opacity: pathOptions.opacity
            } as L.MarkerOptions);
    }

    protected abstract getHoverIcon(color: string): L.DivIcon;

    public getState = (): string => {
        return this.hoverState;
    }

    public setState(state: string) {
        if (this.hoverState === state) {
            return;
        }
        this.hoverState = state;
        switch (this.hoverState) {
            case HoverHandlerState.NONE:
            case HoverHandlerState.ON_MARKER:
                this.context.mapService.map.removeLayer(this.hoverMarker);
                break;
            case HoverHandlerState.ON_POLYLINE:
            case HoverHandlerState.DRAGGING:
                this.context.mapService.map.removeLayer(this.hoverMarker);
                break;
            case HoverHandlerState.ADD_POINT:
                this.context.mapService.map.addLayer(this.hoverMarker);
                break;
        }
    }

    protected canAddPointState(): boolean {
        if (this.hoverState === HoverHandlerState.ON_MARKER ||
            this.hoverState === HoverHandlerState.DRAGGING) {
            return false;
        }
        return true;
    }

    public updateAccordingToRoueProperties() {
        let pathOptions = this.context.route.properties.pathOptions;
        this.hoverMarker.setOpacity(pathOptions.opacity);
        let markerIcon = this.getHoverIcon(pathOptions.color);
        this.hoverMarker.setIcon(markerIcon);
    }
}