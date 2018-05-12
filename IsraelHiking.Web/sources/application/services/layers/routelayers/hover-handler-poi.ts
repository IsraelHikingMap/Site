import { IRouteLayer } from "./iroute.layer";
import { HoverHandlerBase, HoverHandlerState } from "./hover-handler-base";
import { IconsService } from "../../icons.service";

export class HoverHandlerPoi extends HoverHandlerBase {
    constructor(context: IRouteLayer) {
        super(context);
        this.setState(HoverHandlerState.NONE);
        this.updateAccordingToRoueProperties();
    }

    protected getHoverIcon(color: string): L.DivIcon {
        return IconsService.createPoiHoverMarkerIcon(color);
    }

    public onMouseMove = (e: L.LeafletMouseEvent): void => {
        if (!this.canAddPointState()) {
            return;
        }

        this.setState(HoverHandlerState.ADD_POINT);
        let snapToPointResponse = this.context.getSnappingForPoint(e.latlng);
        for (let marker of this.context.route.markers) {
            if (marker.marker != null && marker.marker.getLatLng().equals(snapToPointResponse.latlng)) {
                // do not snap to self points
                this.hoverMarker.setLatLng(e.latlng);
                return;
            }
        }
        this.hoverMarker.setLatLng(snapToPointResponse.latlng);
    }
}