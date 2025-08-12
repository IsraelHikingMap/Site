import { inject, Injectable, NgZone } from "@angular/core";
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
import type { ApplicationState, MarkerData, LatLngAlt } from "../../models";

@Injectable()
export class RouteEditPoiInteraction {

    private readonly matDialog = inject(MatDialog);
    private readonly ngZone = inject(NgZone);
    private readonly selectedRouteService = inject(SelectedRouteService);
    private readonly snappingService = inject(SnappingService);
    private readonly poiService = inject(PoiService);
    private readonly resources = inject(ResourcesService);
    private readonly store = inject(Store);

    public setActive(active: boolean, map: Map) {
        if (active) {
            map.on("click", this.handleClick);
        } else {
            map.off("click", this.handleClick);
        }
    }

    private handleClick = (event: MapMouseEvent) => {
        if (this.store.selectSnapshot((s: ApplicationState) => s.gpsState).tracking === "tracking") {
            const latLng = event.lngLat;
            const point = event.target.project(latLng);
            const th = 10;
            const gpsMarker = event.target.queryRenderedFeatures([[point.x - th, point.y - th], [point.x + th, point.y + th]],
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
        const recordedRouteState = this.store.selectSnapshot((s: ApplicationState) => s.recordedRouteState);
        if (recordedRouteState.isAddingPoi) {
            const markerData = structuredClone(recordedRouteState.route.markers[index]) as MarkerData;
            markerData.latlng = latlng;
            this.store.dispatch(new UpdateRecordingPoiAction(index, markerData));
        } else {
            const routeData = this.selectedRouteService.getSelectedRoute();
            const markerData = structuredClone(routeData.markers[index]) as MarkerData;
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

        const snapping = await this.getSnappingForPoint(latlng);
        if (snapping.markerData != null) {
            markerData = structuredClone(snapping.markerData) as MarkerData;
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
        const index = selectedRoute.markers.length - 1;
        PrivatePoiEditDialogComponent.openDialog(this.matDialog, markerData, index, selectedRoute.id);
    }

    private addToRecording(markerData: MarkerData) {
        this.store.dispatch(new AddRecordingPoiAction(markerData));
        const index = this.store.selectSnapshot((s: ApplicationState) => s.recordedRouteState).route.markers.length - 1;
        PrivatePoiEditDialogComponent.openDialog(this.matDialog, markerData, index);
    }

    private async getSnappingForPoint(latlng: LatLngAlt): Promise<SnappingPointResponse> {
        const gpsState = this.store.selectSnapshot((s: ApplicationState) => s.gpsState);
        if (gpsState.tracking === "tracking") {
            const currentLocation = GeoLocationService.positionToLatLngTime(gpsState.currentPosition);
            const snappingPointResponse = this.snappingService.snapToPoint(latlng,
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

        const markerData = await this.poiService.getClosestPoint(latlng, "", this.resources.getCurrentLanguageCodeSimplified());
        return this.snappingService.snapToPoint(latlng, markerData ? [markerData] : []);
    }
}
