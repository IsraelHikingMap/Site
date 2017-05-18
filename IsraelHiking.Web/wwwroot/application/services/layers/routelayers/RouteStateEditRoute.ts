import { EditMode } from "./IRouteState";
import { RouteStateEdit } from "./RouteStateEdit";
import { IRouteLayer, EditModeString } from "./IRouteLayer";
import { HoverHandler } from "./HoverHandler";
import { IconsService } from "../../IconsService";
import { ISnappingOptions } from "../../SnappingService";
import * as Common from "../../../common/IsraelHiking";

export class RouteStateEditRoute extends RouteStateEdit {
    constructor(context: IRouteLayer) {
        super(context);
        this.hoverHandler.setRouteHover(true);
    }

    protected addPoint(e: L.MouseEvent): void {
        let snappingResponse = this.context.snappingService.snapTo(e.latlng);
        this.addPointToRoute(snappingResponse.latlng, this.context.route.properties.currentRoutingType).then(() => {
            this.context.raiseDataChanged();
        });
        this.hoverHandler.setState(HoverHandler.NONE);
    }

    private addPointToRoute = (latlng: L.LatLng, routingType: string): Promise<{}> => {
        this.context.route.segments.push(this.createRouteSegment(latlng, [latlng, latlng], routingType));
        this.updateStartAndEndMarkersIcons();
        if (this.context.route.segments.length > 1) {
            let endPointSegmentIndex = this.context.route.segments.length - 1;
            return this.runRouting(endPointSegmentIndex - 1, endPointSegmentIndex);
        } else if (this.context.route.segments.length === 1) {
            return this.context.elevationProvider.updateHeights(this.context.route.segments[0].latlngs);
        }
        return Promise.resolve({});
    }

    public getEditMode(): EditMode {
        return EditModeString.route;
    }
}