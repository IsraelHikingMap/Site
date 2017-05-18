import { IRouteState, EditMode } from "./IRouteState";
import { IRouteLayer } from "./IRouteLayer";
import { RouteStateHidden } from "./RouteStateHidden";
import { RouteStateReadOnly } from "./RouteStateReadOnly";
import { RouteStateEditRoute } from "./RouteStateEditRoute";
import { RouteStateEditPoi } from "./RouteStateEditPoi";
import { IconsService } from "../../IconsService";
import { MapService } from "../../MapService";
import * as Common from "../../../common/IsraelHiking";

export abstract class RouteStateBase implements IRouteState {
    protected context: IRouteLayer;

    constructor(context: IRouteLayer) {
        this.context = context;
    }

    public abstract initialize(): void;
    public abstract clear(): void;
    public abstract getEditMode(): EditMode;

    public reRoute = (): void => { } // does nothing if not overriden

    protected createPoiMarker = (markerData: Common.MarkerData, isEditable: boolean): Common.IMarkerWithTitle => {
        let pathOptions = this.context.route.properties.pathOptions;
        let marker = L.marker(markerData.latlng,
            {
                draggable: isEditable,
                clickable: isEditable,
                keyboard: false,
                riseOnHover: true,
                icon: IconsService.createMarkerIconWithColorAndType(pathOptions.color, markerData.type),
                opacity: pathOptions.opacity
            } as L.MarkerOptions) as Common.IMarkerWithTitle;
        let color = this.context.route.properties.pathOptions.color;
        this.context.mapService.setMarkerTitle(marker, markerData.title, color);
        marker.addTo(this.context.mapService.map);
        return marker;
    }
}