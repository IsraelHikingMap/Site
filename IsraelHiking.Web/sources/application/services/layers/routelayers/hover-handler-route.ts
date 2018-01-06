import * as L from "leaflet";

import { HoverHandlerBase, HoverHandlerState } from "./hover-handler-base";
import { IRouteLayer } from "./iroute.layer";
import { IconsService } from "../../icons.service";

export class HoverHandlerRoute extends HoverHandlerBase {
    private hoverPolyline: L.Polyline;

    constructor(context: IRouteLayer, private middleMarker: L.Marker) {
        super(context);
        this.hoverPolyline = L.polyline([]);
        this.setState(HoverHandlerState.NONE);
        this.updateAccordingToRoueProperties();
    }

    protected getHoverIcon(color: string): L.DivIcon {
        return IconsService.createRouteMarkerIcon(color);
    }

    public setState(state: string): void {
        super.setState(state);
        switch (this.hoverState) {
            case HoverHandlerState.NONE:
            case HoverHandlerState.ON_MARKER:
                this.context.mapService.map.removeLayer(this.hoverPolyline);
                this.context.mapService.map.removeLayer(this.middleMarker);
                break;
            case HoverHandlerState.ON_POLYLINE:
            case HoverHandlerState.DRAGGING:
                this.context.mapService.map.removeLayer(this.hoverPolyline);
                this.context.mapService.map.addLayer(this.middleMarker);
                break;
            case HoverHandlerState.ADD_POINT:
                this.context.mapService.map.addLayer(this.hoverPolyline);
                this.context.mapService.map.removeLayer(this.middleMarker);
                break;
        }
    }

    public onMouseMove = (e: L.LeafletMouseEvent): void => {
        if (!this.canAddPointState()) {
            return;
        }

        let snappingPointResponse = this.context.snappingService.snapToPoint(e.latlng, { points: this.context.route.markers, sensitivity: 30 });
        if (snappingPointResponse.markerData != null) {
            this.setHoverLineForAddPoint(snappingPointResponse.latlng);
            return;
        }
        
        let snappingRouteResponse = this.context.snapToSelf(e.latlng);
        if (snappingRouteResponse.polyline != null) {
            this.setState(HoverHandlerState.ON_POLYLINE);
            this.middleMarker.setOpacity(1.0);
            this.middleMarker.setLatLng(snappingRouteResponse.latlng);
            return;
        }

        snappingRouteResponse = this.context.snappingService.snapToRoute(e.latlng);
        this.setHoverLineForAddPoint(snappingRouteResponse.latlng);
    }

    private setHoverLineForAddPoint(latlng: L.LatLng) {
        this.middleMarker.setOpacity(0.0);
        this.setState(HoverHandlerState.ADD_POINT);
        this.hoverMarker.setLatLng(latlng);
        var hoverStartPoint = this.context.route.segments.length > 0
            ? this.context.getLastSegment().routePoint
            : latlng;
        this.hoverPolyline.setLatLngs([hoverStartPoint, latlng]);
    }

    public updateAccordingToRoueProperties(): void {
        let pathOptions = this.context.route.properties.pathOptions;
        super.updateAccordingToRoueProperties();
        this.middleMarker.setIcon(IconsService.createRoundIcon(pathOptions.color));
        let style = { ...pathOptions, dashArray: "10, 10" } as L.PolylineOptions;
        this.hoverPolyline.setStyle(style);
    }
}