import { Subscription } from "rxjs";

import { IRouteState, RouteStateName } from "./iroute-state";
import { IRouteLayer } from "./iroute.layer";

export abstract class RouteStateBase implements IRouteState {
    protected context: IRouteLayer;
    private gpsLocationSubscription: Subscription;

    protected constructor(context: IRouteLayer) {
        this.context = context;
        this.gpsLocationSubscription = null;
    }

    public initialize(): void {
        if (this.context.route.properties.isRecording) {
            this.gpsLocationSubscription = this.context.geoLocationService.positionChanged.subscribe(() => {
                this.addPosition();
            });
        }
        
    };
    public clear(): void {
        if (this.gpsLocationSubscription != null) {
            this.gpsLocationSubscription.unsubscribe();
            this.gpsLocationSubscription = null;
        }
    }

    protected addPosition() {
        let latLng = this.context.geoLocationService.currentLocation;
        let segment = this.context.getLastSegment();
        segment.latlngs.push(latLng);
        if (segment.polyline != null) {
            segment.polyline.setLatLngs(segment.latlngs);
        }
        segment.routePoint = latLng;
        this.context.raiseDataChanged();
    }

    public abstract getStateName(): RouteStateName;
    public reRoute = (): void => { }; // does nothing if not overriden
}