import { RouteStateEdit } from "./RouteStateEdit";
import { IRouteLayer, EditModeString } from "./IRouteLayer";
import { EditMode } from "./IRouteState";
import * as Common from "../../../common/IsraelHiking";

export class RouteStateEditPoi extends RouteStateEdit {
    constructor(context: IRouteLayer) {
        super(context);
        this.hoverHandler.setRouteHover(false);
    }

    protected addPoint(e: L.MouseEvent) {
        let marker = this.createPoiMarkerWithEvents({ latlng: e.latlng, title: "" } as Common.MarkerData);
        this.context.route.markers.push({
            latlng: e.latlng,
            marker: marker,
            title: "",
            type: ""
        });
        setTimeout(() => marker.openPopup(), 200);
        this.context.raiseDataChanged();
    }

    public getEditMode(): EditMode {
        return EditModeString.poi;
    }
}