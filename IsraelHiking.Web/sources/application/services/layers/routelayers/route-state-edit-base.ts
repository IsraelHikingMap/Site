import * as L from "leaflet";

import { RouteStateBase } from "./route-state-base";
import { IRouteLayer } from "./iroute.layer";
import { HoverHandlerBase, HoverHandlerState } from "./hover-handler-base";

export abstract class RouteStateEditBase extends RouteStateBase {
    protected hoverHandler: HoverHandlerBase;

    constructor(context: IRouteLayer) {
        super(context);
    }

    protected abstract addPoint(e: L.LeafletMouseEvent): void;

    public initialize() {
        this.context.mapService.map.on("click", this.addPoint, this);
        this.context.mapService.map.on("mousemove", this.hoverHandler.onMouseMove, this.hoverHandler);
        this.hoverHandler.updateAccordingToRoueProperties();
        this.context.snappingService.enable(true);

        for (let segment of this.context.route.segments) {
            segment.polyline = L.polyline(segment.latlngs, this.context.route.properties.pathOptions);
            this.context.mapService.map.addLayer(segment.polyline);
        }
    }

    public clear() {
        for (let segment of this.context.route.segments) {
            this.context.mapService.map.removeLayer(segment.polyline);
            this.destoryMarker(segment.routePointMarker);
        }
        for (let marker of this.context.route.markers) {
            this.destoryMarker(marker.marker);
        }
        this.context.snappingService.enable(false);
        this.context.mapService.map.off("mousemove", this.hoverHandler.onMouseMove, this.hoverHandler);
        this.context.mapService.map.off("click", this.addPoint, this);
        this.hoverHandler.setState(HoverHandlerState.NONE);
    }
}