import * as L from "leaflet";
import { Subscription } from "rxjs";

import { RouteStateBase } from "./route-state-base";
import { IRouteLayer, IRouteSegment } from "./iroute.layer";
import { EditMode } from "./iroute-state";
import * as Common from "../../../common/IsraelHiking";

export class RouteStateRecording extends RouteStateBase {
    private subscription: Subscription;

    constructor(context: IRouteLayer) {
        super(context);
        this.initialize();
    }

    public initialize(): void {

        if (this.context.route.segments.length === 0) {
            let polyline = L.polyline([], this.context.route.properties.pathOptions);
            this.context.route.segments.push({
                latlngs: [],
                routePoint: null,
                routingType: "Hike",
                polyline: polyline,
                routePointMarker: null
            } as IRouteSegment);
            this.context.mapService.map.addLayer(polyline);
        }

        if (this.context.geoLocationService.currentLocation != null) {
            this.addPosition();
        }

        this.subscription = this.context.geoLocationService.positionChanged.subscribe(() => {
            this.addPosition();
        });
    }

    private addPosition() {
        let latLng = this.context.geoLocationService.currentLocation;
        let segment = this.context.route.segments[0];
        segment.latlngs.push(latLng);
        segment.polyline.setLatLngs(segment.latlngs);
        segment.routePoint = latLng;
    }

    public clear(): void {
        this.context.mapService.map.removeLayer(this.context.route.segments[0].polyline);
        this.context.route.segments[0].polyline = null;
        this.subscription.unsubscribe();
    }

    public getEditMode(): EditMode {
        return "None";
    }


}