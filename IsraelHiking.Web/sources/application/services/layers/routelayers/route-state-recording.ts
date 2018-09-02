import { Subscription } from "rxjs";
import * as L from "leaflet";
import * as _ from "lodash";

import { RouteStateBase } from "./route-state-base";
import { IRouteLayer, IRouteSegment } from "./iroute.layer";
import { RouteStateName } from "./iroute-state";
import { RouteStatePoiHelper } from "./route-state-poi-helper";
import { RouteStateHelper } from "./route-state-helper";
import * as Common from "../../../common/IsraelHiking";

export class RouteStateRecording extends RouteStateBase {
    private subscription: Subscription;

    constructor(context: IRouteLayer) {
        super(context);
        this.initialize();
    }

    public initialize(): void {
        if (this.context.route.segments.length === 0) {
            let latlngs = [];
            let routePoint = null;
            let currentLocation = this.context.geoLocationService.currentLocation;
            if (currentLocation != null) {
                latlngs = [currentLocation];
                routePoint = currentLocation;
            }
            this.context.route.segments.push({
                latlngs: latlngs,
                routePoint: routePoint,
                routingType: "Hike",
                polyline: null,
                routePointMarker: null
            } as IRouteSegment);
        }
        let polyline = L.polyline(this.context.route.segments[0].latlngs, this.context.route.properties.pathOptions);
        this.context.route.segments[0].polyline = polyline;
        this.context.mapService.map.addLayer(polyline);


        this.subscription = this.context.geoLocationService.positionChanged.subscribe(() => {
            this.addPosition();
        });

        for (let marker of this.context.route.markers) {
            marker.marker = RouteStatePoiHelper.createPoiMarker(marker, false, this.context);
            let component = RouteStatePoiHelper.addComponentToPoiMarker(marker.marker, this.context);
            component.isEditMode = false;
            component.changeToEditMode = () => this.changeStateToEditPoi(marker.marker);
        }
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
        return "Recording";
    }

    private changeStateToEditPoi(markerWithTitle: Common.IMarkerWithTitle) {
        let markerLatLng = markerWithTitle.getLatLng();
        this.context.setRecordingPoiState();
        // old markers are destroyed and new markers are created.
        let newMarker = _.find(this.context.route.markers, m => m.marker != null && m.marker.getLatLng().equals(markerLatLng));
        if (newMarker != null) {
            newMarker.marker.openPopup();
        }
    }
}