import * as L from "leaflet";
import * as _ from "lodash";

import { RouteStateEditBase } from "./route-state-edit-base";
import { IRouteLayer } from "./iroute.layer";
import { RouteStateHelper } from "./route-state-helper";
import { RouteStatePoiHelper } from "./route-state-poi-helper";
import { IMarkerWithTitle, RouteStateName } from "../../../models/models";

export class RouteStateEditPoi extends RouteStateEditBase {
    constructor(context: IRouteLayer) {
        super(context);
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

    private setMarkerHoverEvents(marker: IMarkerWithTitle) {
        marker.on("dragstart", () => {
            //this.hoverHandler.setState(HoverHandlerState.DRAGGING);
        });
        marker.on("dragend", () => {
            //this.hoverHandler.setState(HoverHandlerState.NONE);
        });
        marker.on("mouseover", () => {
            //if (this.hoverHandler.getState() !== HoverHandlerState.DRAGGING) {
            //    this.hoverHandler.setState(HoverHandlerState.ON_MARKER);
            //}
        });
        marker.on("mouseout", () => {
            //if (this.hoverHandler.getState() !== HoverHandlerState.DRAGGING) {
            //    this.hoverHandler.setState(HoverHandlerState.NONE);
            //}
        });
    }

    protected addPosition(): void {
        super.addPosition();
        RouteStateHelper.createStartAndEndMarkers(this.context);
    }
}