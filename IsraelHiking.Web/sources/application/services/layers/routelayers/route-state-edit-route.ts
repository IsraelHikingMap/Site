import { EditMode } from "./iroute-state";
import { RouteStateEdit } from "./route-state-edit";
import { IRouteLayer, EditModeString } from "./iroute.layer";
import { HoverHandler } from "./hover-handler";

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