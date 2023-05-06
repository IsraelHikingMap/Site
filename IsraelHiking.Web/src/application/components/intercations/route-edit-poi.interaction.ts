import { Injectable, NgZone } from "@angular/core";
import { MapMouseEvent, Map } from "maplibre-gl";
import { MatDialog } from "@angular/material/dialog";
import { NgRedux } from "@angular-redux2/store";

import { SelectedRouteService } from "../../services/selected-route.service";
import { PrivatePoiEditDialogComponent } from "../dialogs/private-poi-edit-dialog.component";
import { GeoLocationService } from "../../services/geo-location.service";
import { SnappingService, SnappingPointResponse } from "../../services/snapping.service";
import { PoiService } from "../../services/poi.service";
import { ResourcesService } from "../../services/resources.service";
import { RoutesReducer } from "../../reducers/routes.reducer";
import { RecordedRouteReducer } from "../../reducers/recorded-route.reducer";
import type { ApplicationState, MarkerData, LatLngAlt } from "../../models/models";

@Injectable()
export class RouteEditPoiInteraction {

    constructor(private readonly matDialog: MatDialog,
                private readonly ngZone: NgZone,
                private readonly selectedRouteService: SelectedRouteService,
                private readonly snappingService: SnappingService,
                private readonly poiService: PoiService,
                private readonly resources: ResourcesService,
                private readonly ngRedux: NgRedux<ApplicationState>) {
    }

    public setActive(active: boolean, map: Map) {
        if (active) {
            map.on("click", this.handleClick);
        } else {
            map.off("click", this.handleClick);
        }
    }

    private handleClick = (event: MapMouseEvent) => {
        if (this.ngRedux.getState().gpsState.tracking === "tracking") {
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
        if (this.ngRedux.getState().recordedRouteState.isAddingPoi) {
            let markerData = { ...this.ngRedux.getState().recordedRouteState.route.markers[index] };
            markerData.latlng = latlng;
            this.ngRedux.dispatch(RecordedRouteReducer.actions.updateRecordingPoi({
                index,
                markerData
            }));
        } else {
            let routeData = this.selectedRouteService.getSelectedRoute();
            let markerData = { ...routeData.markers[index] } as MarkerData;
            markerData.latlng = latlng;
            this.ngRedux.dispatch(RoutesReducer.actions.updatePoi({
                routeId: routeData.id,
                index,
                markerData
            }));
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
        if (this.ngRedux.getState().recordedRouteState.isAddingPoi) {
            this.addToRecording(markerData);
            return;
        }

        let snapping = await this.getSnappingForPoint(latlng);
        if (snapping != null) {
            markerData = { ...snapping.markerData }
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
        this.ngRedux.dispatch(RoutesReducer.actions.addPoi({
            routeId: selectedRoute.id,
            markerData
        }));
        selectedRoute = this.selectedRouteService.getSelectedRoute();
        let index = selectedRoute.markers.length - 1;
        PrivatePoiEditDialogComponent.openDialog(this.matDialog, markerData, index, selectedRoute.id);
    }

    private addToRecording(markerData: MarkerData) {
        this.ngRedux.dispatch(RecordedRouteReducer.actions.addRecordingPoi({
            markerData
        }));
        let index = this.ngRedux.getState().recordedRouteState.route.markers.length - 1;
        PrivatePoiEditDialogComponent.openDialog(this.matDialog, markerData, index);
    }

    private async getSnappingForPoint(latlng: LatLngAlt): Promise<SnappingPointResponse> {
        if (this.ngRedux.getState().gpsState.tracking === "tracking") {
            let currentLocation = GeoLocationService.positionToLatLngTime(this.ngRedux.getState().gpsState.currentPoistion);
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
