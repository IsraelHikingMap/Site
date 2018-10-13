import * as L from "leaflet";

import { RouteStateBase } from "./route-state-base";
import { IRouteLayer } from "./iroute.layer";
import { RouteStateHelper } from "./route-state-helper";

export abstract class RouteStateEditBase extends RouteStateBase {
    constructor(context: IRouteLayer) {
        super(context);
    }

    protected abstract addPoint(e: L.LeafletMouseEvent): void;

    public initialize() {
        super.initialize();
        this.context.mapService.map.on("click", this.addPoint, this);
        if (!this.context.route.properties.isRecording) {
            this.context.snappingService.enable(true);
        }

        // for (let segment of this.context.route.segments) {
            // segment.polyline = L.polyline(segment.latlngs, this.context.route.properties.pathOptions);
            // this.context.mapService.map.addLayer(segment.polyline);
        // }
    }

    public clear() {
        RouteStateHelper.removeLayersFromMap(this.context);
        this.context.snappingService.enable(false);
        // this.context.mapService.map.off("click", this.addPoint, this);
        super.clear();
    }
}