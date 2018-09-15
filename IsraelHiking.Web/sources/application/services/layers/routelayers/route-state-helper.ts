import * as L from "leaflet";

import { IconsService } from "../../icons.service";
import { IRouteLayer } from "./iroute.layer";

export class RouteStateHelper {
    public static destroyMarker = (marker: L.Marker, context: IRouteLayer) => {
        if (marker == null) {
            return;
        }
        marker.closePopup();
        marker.off("click");
        marker.off("dragstart");
        marker.off("drag");
        marker.off("dragend");
        marker.off("mouseover");
        marker.off("mouseout");
        marker.off("dblclick");
        marker.off("popupopen");
        marker.off("popupclose");
        context.mapService.map.removeLayer(marker);
    }

    public static removeLayersFromMap(context: IRouteLayer) {
        for (let segment of context.route.segments) {
            RouteStateHelper.destroyMarker(segment.routePointMarker, context);
            segment.routePointMarker = null;
            if (segment.polyline != null) {
                context.mapService.map.removeLayer(segment.polyline);
                segment.polyline = null;
            }
        }
        for (let marker of context.route.markers) {
            RouteStateHelper.destroyMarker(marker.marker, context);
            marker.marker = null;
        }
    }

    public static createStartAndEndMarkers(context: IRouteLayer) {
        if (context.route.segments.length <= 0) {
            return;
        }

        let startLatLng = context.route.segments[0].latlngs[0];
        let pathOptions = context.route.properties.pathOptions;
        let marker = L.marker(startLatLng,
            {
                opacity: pathOptions.opacity,
                draggable: false,
                clickable: false,
                riseOnHover: false,
                icon: IconsService.createRoundIcon("green")
            }).addTo(context.mapService.map);
        if (context.route.segments[0].routePointMarker != null) {
            RouteStateHelper.destroyMarker(context.route.segments[0].routePointMarker, context);
        }
        context.route.segments[0].routePointMarker = marker;
        let endLatLng = context.getLastLatLng();
        marker = L.marker(endLatLng,
            {
                opacity: pathOptions.opacity,
                draggable: false,
                clickable: false,
                riseOnHover: false,
                icon: IconsService.createRoundIcon("red")
            }).addTo(context.mapService.map);
        if (context.getLastSegment().routePointMarker != null) {
            RouteStateHelper.destroyMarker(context.getLastSegment().routePointMarker, context);
        }
        context.getLastSegment().routePointMarker = marker;
    }
}