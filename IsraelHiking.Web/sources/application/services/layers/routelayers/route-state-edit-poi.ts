import * as L from "leaflet";
import * as _ from "lodash";

import { RouteStateEditBase } from "./route-state-edit-base";
import { IRouteLayer } from "./iroute.layer";
import { RouteStateName } from "./iroute-state";
import { HoverHandlerState } from "./hover-handler-base";
import { HoverHandlerPoi } from "./hover-handler-poi";
import { RouteStateHelper } from "./route-state-helper";
import { RouteStatePoiHelper } from "./route-state-poi-helper";
import * as Common from "../../../common/IsraelHiking";

export class RouteStateEditPoi extends RouteStateEditBase {
    constructor(context: IRouteLayer) {
        super(context);
        this.hoverHandler = new HoverHandlerPoi(context);
        this.initialize();
    }

    public initialize(): void {
        super.initialize();
        RouteStateHelper.createStartAndEndMarkers(this.context);
        for (let routeMarkerWithData of this.context.route.markers) {
            routeMarkerWithData.marker = RouteStatePoiHelper.createPoiMarker(routeMarkerWithData, true, this.context);
            RouteStatePoiHelper.setPoiMarkerEvents(routeMarkerWithData.marker, this.context);
            this.setMarkerHoverEvents(routeMarkerWithData.marker);
        }
    }

    protected addPoint(e: L.LeafletMouseEvent) {
        let markerWithData = RouteStatePoiHelper.addPoint(e, this.context);
        this.setMarkerHoverEvents(markerWithData.marker);
    }

    public getStateName(): RouteStateName {
        return "Poi";
    }

    private setMarkerHoverEvents(marker: Common.IMarkerWithTitle) {
        marker.on("dragstart", () => {
            this.hoverHandler.setState(HoverHandlerState.DRAGGING);
        });
        marker.on("dragend", () => {
            this.hoverHandler.setState(HoverHandlerState.NONE);
        });
        marker.on("mouseover", () => {
            if (this.hoverHandler.getState() !== HoverHandlerState.DRAGGING) {
                this.hoverHandler.setState(HoverHandlerState.ON_MARKER);
            }
        });
        marker.on("mouseout", () => {
            if (this.hoverHandler.getState() !== HoverHandlerState.DRAGGING) {
                this.hoverHandler.setState(HoverHandlerState.NONE);
            }
        });
    }

    protected addPosition(): void {
        super.addPosition();
        RouteStateHelper.createStartAndEndMarkers(this.context);
    }
}