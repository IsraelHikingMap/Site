import { Subscription } from "rxjs";
import * as L from "leaflet";

import { RouteStateBase } from "./route-state-base";
import { IRouteLayer } from "./iroute.layer";
import { RouteStateName } from "./iroute-state";
import { RouteStatePoiHelper } from "./route-state-poi-helper";
import { RouteStateHelper } from "./route-state-helper";

export class RouteStateRecordingPoi extends RouteStateBase {
    private subscription: Subscription;

    constructor(context: IRouteLayer) {
        super(context);
        this.initialize();
    }

    public initialize(): void {
        let polyline = L.polyline(this.context.route.segments[0].latlngs, this.context.route.properties.pathOptions);
        this.context.route.segments[0].polyline = polyline;
        this.context.mapService.map.addLayer(polyline);

        this.subscription = this.context.geoLocationService.positionChanged.subscribe(() => {
            this.addPosition();
        });

        for (let routeMarkerWithData of this.context.route.markers) {
            routeMarkerWithData.marker = RouteStatePoiHelper.createPoiMarker(routeMarkerWithData, true, this.context);
            RouteStatePoiHelper.addComponentToPoiMarkerAndEvents(routeMarkerWithData.marker, this.context);
        }

        this.context.mapService.map.on("click", (e: L.LeafletMouseEvent) => {
            RouteStatePoiHelper.addPoint(e, this.context);
        });
    }

    private addPosition() {
        let latLng = this.context.geoLocationService.currentLocation;
        let segment = this.context.route.segments[0];
        segment.latlngs.push(latLng);
        segment.polyline.setLatLngs(segment.latlngs);
        segment.routePoint = latLng;
        this.context.raiseDataChanged();
    }

    public clear(): void {
        RouteStateHelper.removeLayersFromMap(this.context);
        this.subscription.unsubscribe();
    }

    public getStateName(): RouteStateName {
        return "RecordingPoi";
    }


}