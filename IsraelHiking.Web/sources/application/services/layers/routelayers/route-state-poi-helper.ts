import * as L from "leaflet";
import * as _ from "lodash";

import { IconsService } from "../../icons.service";
import { IRouteLayer, IMarkerWithData } from "./iroute.layer";
import { RouteStateHelper } from "./route-state-helper";
import { IMarkerWithTitle, MarkerData } from "../../../models/models";

export class RouteStatePoiHelper {

    public static createPoiMarker(markerData: MarkerData, isEditable: boolean, context: IRouteLayer): IMarkerWithTitle {
        let pathOptions = context.route.properties.pathOptions;
        let color = context.route.properties.pathOptions.color;
        let marker = L.marker(markerData.latlng,
            {
                draggable: isEditable,
                clickable: isEditable,
                riseOnHover: isEditable,
                icon: IconsService.createMarkerIconWithColorAndType(color, markerData.type),
                opacity: pathOptions.opacity
            } as L.MarkerOptions) as IMarkerWithTitle;
        marker.identifier = markerData.id;
        return marker;
    }

    public static addReadOnlyComponentToPoiMarker(marker: IMarkerWithTitle, context: IRouteLayer) {
    }

    public static addPoint(e: L.LeafletMouseEvent, context: IRouteLayer): IMarkerWithData {
        let snappingPointResponse = context.getSnappingForPoint(e.latlng);
        let markerData = {
            latlng: snappingPointResponse.latlng,
            title: "",
            type: IconsService.getAvailableIconTypes()[0]
        } as MarkerData;
        if (snappingPointResponse.markerData) {
            markerData = snappingPointResponse.markerData;
        }
        let marker = RouteStatePoiHelper.createPoiMarker(markerData, true, context);
        marker.identifier = markerData.id;
        let markerWithData = markerData as IMarkerWithData;
        markerWithData.marker = marker;
        context.route.markers.push(markerWithData);
        RouteStatePoiHelper.setPoiMarkerEvents(marker, context);
        marker.fire("click");
        context.raiseDataChanged();
        return markerWithData;
    }

    public static setPoiMarkerEvents(marker: IMarkerWithTitle, context: IRouteLayer) {
        marker.on("drag", () => {
            let snappingResponse = context.getSnappingForPoint(marker.getLatLng());
            marker.setLatLng(snappingResponse.latlng);
        });
        marker.on("dragend", () => {
            let markerInArray = _.find(context.route.markers, markerToFind => markerToFind.marker === marker) as IMarkerWithData;
            markerInArray.latlng = marker.getLatLng();
            let snappingPointResponse = context.getSnappingForPoint(markerInArray.latlng);
            if (snappingPointResponse.markerData != null &&
                !markerInArray.title &&
                markerInArray.type === IconsService.getAvailableIconTypes()[0]) {
                markerInArray.title = snappingPointResponse.markerData.title;
                markerInArray.type = snappingPointResponse.markerData.type;
                markerInArray.description = snappingPointResponse.markerData.description;
                markerInArray.urls = snappingPointResponse.markerData.urls;
                marker.identifier = snappingPointResponse.markerData.id;
                let color = context.route.properties.pathOptions.color;
                marker.setIcon(IconsService.createMarkerIconWithColorAndType(color, snappingPointResponse.markerData.type));
                //context.mapService.setMarkerTitle(marker, snappingPointResponse.markerData, color);
            }
            context.raiseDataChanged();
        });
    }

    private static removePoi(poi: IMarkerWithData, context: IRouteLayer) {
        context.route.markers.splice(context.route.markers.indexOf(poi), 1);
        RouteStateHelper.destroyMarker(poi.marker, context);
        context.raiseDataChanged();
    }
}