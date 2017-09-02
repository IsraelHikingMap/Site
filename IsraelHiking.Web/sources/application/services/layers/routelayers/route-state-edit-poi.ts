import * as L from "leaflet";

import { RouteStateEditBase } from "./route-state-edit-base";
import { IconsService } from "../../icons.service";
import { IRouteLayer, EditModeString } from "./iroute.layer";
import { EditMode } from "./iroute-state";
import * as Common from "../../../common/IsraelHiking";

export class RouteStateEditPoi extends RouteStateEditBase {
    constructor(context: IRouteLayer) {
        super(context);
        this.hoverHandler.setRouteHover(false);
    }

    protected addPoint(e: L.LeafletMouseEvent) {
        let marker = this.createPoiMarker({ latlng: e.latlng, title: "" } as Common.MarkerData, true);
        this.context.route.markers.push({
            latlng: e.latlng,
            marker: marker,
            title: "",
            type: IconsService.getAvailableIconTypes()[0]
        });
        this.addComponentToMarker(marker);
        setTimeout(() => marker.openPopup(), 200);
        this.context.raiseDataChanged();
    }

    public getEditMode(): EditMode {
        return EditModeString.poi;
    }
}