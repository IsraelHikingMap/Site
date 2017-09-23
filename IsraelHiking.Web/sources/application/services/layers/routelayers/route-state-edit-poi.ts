import * as L from "leaflet";

import { RouteStateEditBase } from "./route-state-edit-base";
import { IconsService } from "../../icons.service";
import { IRouteLayer, EditModeString, IMarkerWithData } from "./iroute.layer";
import { EditMode } from "./iroute-state";
import * as Common from "../../../common/IsraelHiking";

export class RouteStateEditPoi extends RouteStateEditBase {
    constructor(context: IRouteLayer) {
        super(context);
        this.hoverHandler.setRouteHover(false);
    }

    protected addPoint(e: L.LeafletMouseEvent) {
        let snappingPointResponse = this.context.snappingService.snapToPoint(e.latlng);
        let markerData = {
            latlng: snappingPointResponse.latlng,
            title: "",
            type: IconsService.getAvailableIconTypes()[0]
        } as Common.MarkerData;
        if (snappingPointResponse.markerData) {
            markerData = snappingPointResponse.markerData;
        }
        let marker = this.createPoiMarker(markerData, true);
        marker.identifier = markerData.id;
        let markerWithData = markerData as IMarkerWithData;
        markerWithData.marker = marker;
        this.context.route.markers.push(markerWithData);
        this.addComponentToMarker(marker);
        setTimeout(() => marker.openPopup(), 200);
        this.context.raiseDataChanged();
    }

    public getEditMode(): EditMode {
        return EditModeString.poi;
    }
}