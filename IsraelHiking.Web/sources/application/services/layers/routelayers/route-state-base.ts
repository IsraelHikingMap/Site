import * as L from "leaflet";

import { IRouteState, EditMode } from "./iroute-state";
import { IRouteLayer } from "./iroute.layer";
import { IconsService } from "../../icons.service";
import * as Common from "../../../common/IsraelHiking";

export abstract class RouteStateBase implements IRouteState {
    protected context: IRouteLayer;

    protected constructor(context: IRouteLayer) {
        this.context = context;
    }

    public abstract initialize(): void;
    public abstract clear(): void;
    public abstract getEditMode(): EditMode;

    public reRoute = (): void => { } // does nothing if not overriden

    protected createPoiMarker = (markerData: Common.MarkerData, isEditable: boolean): Common.IMarkerWithTitle => {
        let pathOptions = this.context.route.properties.pathOptions;
        let color = this.context.route.properties.pathOptions.color;
        let marker = L.marker(markerData.latlng,
            {
                draggable: isEditable,
                clickable: isEditable,
                riseOnHover: isEditable,
                icon: IconsService.createMarkerIconWithColorAndType(color, markerData.type),
                opacity: pathOptions.opacity
            } as L.MarkerOptions) as Common.IMarkerWithTitle;
        marker.identifier = markerData.id;
        this.context.mapService.setMarkerTitle(marker, markerData.title, color);
        marker.addTo(this.context.mapService.map);
        return marker;
    }
}