import * as L from "leaflet";
import * as _ from "lodash";

import { RouteStateBase } from "./route-state-base";
import { IRouteLayer } from "./iroute.layer";
import { RouteStateHelper } from "./route-state-helper";
import { RouteStatePoiHelper } from "./route-state-poi-helper";
import { LatLngAlt, IMarkerWithTitle, RouteStateName } from "../../../models/models";

export class RouteStateReadOnly extends RouteStateBase {
    constructor(context: IRouteLayer) {
        super(context);
        this.initialize();
    }

    private addPolyline(latlngs: LatLngAlt[]): void {
        let routePathOptions = { ...this.context.route.properties.pathOptions } as L.PathOptions;
        routePathOptions.dashArray = "30 10";
        routePathOptions.className = "segment-readonly-indicator";
        let polyline = L.polyline(latlngs, routePathOptions);
    }

    public initialize() {
        super.initialize();
        for (let marker of this.context.route.markers) {
            marker.marker = RouteStatePoiHelper.createPoiMarker(marker, false, this.context);
            let component = RouteStatePoiHelper.addReadOnlyComponentToPoiMarker(marker.marker, this.context);
            component.changeToEditMode = () => this.changeStateToEditPoi(marker.marker);
        }
        this.context.mapService.map.on("mousemove", this.onMouseMove);
        RouteStateHelper.createStartAndEndMarkers(this.context);
    }

    public clear() {
        RouteStateHelper.removeLayersFromMap(this.context);
        super.clear();
    }

    public getStateName(): RouteStateName {
        return "ReadOnly";
    }

    private onMouseMove = (e: L.LeafletMouseEvent): void => {
        let response = this.context.snapToSelf(e.latlng);
        if (response.line == null) {
            this.context.polylineHovered.next(null);
        } else {
            this.context.polylineHovered.next(response.latlng);
        }
    }

    private changeStateToEditPoi(markerWithTitle: IMarkerWithTitle) {
        let markerLatLng = markerWithTitle.getLatLng();
        this.context.setEditPoiState();
        // old markers are destroyed and new markers are created.
        let newMarker = _.find(this.context.route.markers, m => m.marker != null && m.marker.getLatLng().equals(markerLatLng));
        if (newMarker != null) {
            newMarker.marker.fire("click");
        }
    }

    protected addPosition(): void {
        super.addPosition();
        let latLng = this.context.geoLocationService.currentLocation;
        RouteStateHelper.createStartAndEndMarkers(this.context);
    }
}