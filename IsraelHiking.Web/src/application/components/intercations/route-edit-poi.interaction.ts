import { Injectable, NgZone } from "@angular/core";
import { MapMouseEvent, Map } from "maplibre-gl";
import { MatDialog } from "@angular/material/dialog";
import { Store } from "@ngxs/store";

import { SelectedRouteService } from "../../services/selected-route.service";
import { PrivatePoiEditDialogComponent } from "../dialogs/private-poi-edit-dialog.component";
import { GeoLocationService } from "../../services/geo-location.service";
import { SnappingService, SnappingPointResponse } from "../../services/snapping.service";
import { PoiService } from "../../services/poi.service";
import { ResourcesService } from "../../services/resources.service";
import { AddPrivatePoiAction, UpdatePrivatePoiAction } from "../../reducers/routes.reducer";
import { AddRecordingPoiAction, UpdateRecordingPoiAction } from "../../reducers/recorded-route.reducer";
import type { ApplicationState, MarkerData, LatLngAlt } from "../../models/models";

@Injectable()
export class RouteEditPoiInteraction {

    constructor(private readonly matDialog: MatDialog,
                private readonly ngZone: NgZone,
                private readonly selectedRouteService: SelectedRouteService,
                private readonly snappingService: SnappingService,
                private readonly poiService: PoiService,
                private readonly resources: ResourcesService,
                private readonly store: Store) {
    }

    public setActive(active: boolean, map: Map) {
        if (active) {
            map.on("click", this.handleClick);
        } else {
            map.off("click", this.handleClick);
        }
    }

    private handleClick = (event: MapMouseEvent) => {
        if (this.store.selectSnapshot((s: ApplicationState) => s.gpsState).tracking === "tracking") {
            let latLng = event.lngLat;
            let point = event.target.project(latLng);
            let th = 10;
            let gpsMarker = event.target.queryRenderedFeatures([[point.x - th, point.y - th], [point.x + th, point.y + th]],
                {
                    layers: [this.resources.locationIcon],
                });
            if (gpsMarker.length !== 0) {
                // do not continue the flow in case we click on the gps marker
                return;
            }
        }
        this.ngZone.run(() => {
            this.addPrivatePoi(event.lngLat);
        });
    };

    public handleDragEnd(latlng: LatLngAlt, index: number) {
        let recordedRouteState = this.store.selectSnapshot((s: ApplicationState) => s.recordedRouteState);
        if (recordedRouteState.isAddingPoi) {
            let markerData = { ...recordedRouteState.route.markers[index] };
            markerData.latlng = latlng;
            this.store.dispatch(new UpdateRecordingPoiAction(index, markerData));
        } else {
            let routeData = this.selectedRouteService.getSelectedRoute();
            let markerData = { ...routeData.markers[index] } as MarkerData;
            markerData.latlng = latlng;
            this.store.dispatch(new UpdatePrivatePoiAction(routeData.id, index, markerData));
        }
    }

    private async addPrivatePoi(latlng: LatLngAlt) {
        let markerData: MarkerData = {
            latlng,
            urls: [],
            title: "",
            description: "",
            type: "star"
        };
        if (this.store.selectSnapshot((s: ApplicationState) => s.recordedRouteState).isAddingPoi) {
            this.addToRecording(markerData);
            return;
        }

        let snapping = await this.getSnappingForPoint(latlng);
        if (snapping.markerData != null) {
            markerData = { ...snapping.markerData };
        }
        this.addToSelectedRoute(markerData);
    }

    private addToSelectedRoute(markerData: MarkerData) {
        let selectedRoute = this.selectedRouteService.getSelectedRoute();
        if (selectedRoute == null) {
            return;
        }
        if (selectedRoute.state !== "Poi") {
            return;
        }
        this.store.dispatch(new AddPrivatePoiAction(selectedRoute.id, markerData));
        selectedRoute = this.selectedRouteService.getSelectedRoute();
        let index = selectedRoute.markers.length - 1;
        console.log(index, markerData);
        PrivatePoiEditDialogComponent.openDialog(this.matDialog, markerData, index, selectedRoute.id);
    }

    private addToRecording(markerData: MarkerData) {
        this.store.dispatch(new AddRecordingPoiAction(markerData));
        let index = this.store.selectSnapshot((s: ApplicationState) => s.recordedRouteState).route.markers.length - 1;
        PrivatePoiEditDialogComponent.openDialog(this.matDialog, markerData, index);
    }

    private async getSnappingForPoint(latlng: LatLngAlt): Promise<SnappingPointResponse> {
        let gpsState = this.store.selectSnapshot((s: ApplicationState) => s.gpsState);
        if (gpsState.tracking === "tracking") {
            let currentLocation = GeoLocationService.positionToLatLngTime(gpsState.currentPosition);
            let snappingPointResponse = this.snappingService.snapToPoint(latlng,
                [
                    {
                        latlng: currentLocation,
                        type: "star",
                        urls: [],
                        title: "",
                        description: "",
                    } as MarkerData
                ]);
            if (snappingPointResponse.markerData != null) {
                return snappingPointResponse;
            }
        }

        let markerData = await this.poiService.getClosestPoint(latlng, "", this.resources.getCurrentLanguageCodeSimplified());
        return this.snappingService.snapToPoint(latlng, markerData ? [markerData] : []);
    }
}
