import { Injectable, NgZone } from "@angular/core";
import { MapMouseEvent, Map } from "mapbox-gl";
import { MatDialog } from "@angular/material";
import { NgRedux } from "@angular-redux/store";

import { AddPrivatePoiAction, UpdatePrivatePoiAction } from "../../reducres/routes.reducer";
import { SelectedRouteService } from "../../services/layers/routelayers/selected-route.service";
import { PrivatePoiEditDialogComponent } from "../dialogs/private-poi-edit-dialog.component";
import { GeoLocationService } from "../../services/geo-location.service";
import { SnappingService, ISnappingPointResponse } from "../../services/snapping.service";
import { PoiService } from "../../services/poi.service";
import { ResourcesService } from "../../services/resources.service";
import { ApplicationState, MarkerData, LatLngAlt } from "../../models/models";

@Injectable()
export class RouteEditPoiInteraction {

    constructor(private readonly matDialog: MatDialog,
                private readonly ngZone: NgZone,
                private readonly selectedRouteService: SelectedRouteService,
                private readonly geoLocationService: GeoLocationService,
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
        if (this.geoLocationService.getState() === "tracking") {
            let latLng = event.lngLat;
            let point = event.target.project(latLng);
            let th = 10;
            let gpsMarker = event.target.queryRenderedFeatures([[point.x - th, point.y - th], [point.x + th, point.y + th]],
                {
                    layers: [this.resources.locationIcon],
                });
            if (gpsMarker.length != 0) {
                return;
            }
        }
        this.ngZone.run(() => {
            let selectedRoute = this.selectedRouteService.getSelectedRoute();
            if (selectedRoute == null) {
                return;
            }
            if (selectedRoute.state !== "Poi") {
                return;
            }
            this.addPrivatePoi(event.lngLat);
        });
    }

    public handleDragEnd(latlng: LatLngAlt, index: number) {
        let routeData = this.selectedRouteService.getSelectedRoute();
        let markerData = { ...routeData.markers[index] } as MarkerData;
        markerData.latlng = latlng;
        this.ngRedux.dispatch(new UpdatePrivatePoiAction({
            routeId: routeData.id,
            index,
            markerData
        }));
    }

    private async addPrivatePoi(latlng: LatLngAlt) {
        let snapping = await this.getSnappingForPoint(latlng);
        let markerData = (snapping.markerData != null)
            ? { ...snapping.markerData }
            : {
                latlng,
                urls: [],
                title: "",
                description: "",
                type: "star"
            };
        this.ngRedux.dispatch(new AddPrivatePoiAction({
            routeId: this.selectedRouteService.getSelectedRoute().id,
            markerData
        }));
        let selectedRoute = this.selectedRouteService.getSelectedRoute();
        let index = selectedRoute.markers.length - 1;
        PrivatePoiEditDialogComponent.openDialog(this.matDialog, selectedRoute.markers[index], selectedRoute.id, index);
    }

    private async getSnappingForPoint(latlng: LatLngAlt): Promise<ISnappingPointResponse> {
        if (this.geoLocationService.getState() === "tracking") {
            let snappingPointResponse = this.snappingService.snapToPoint(latlng,
                [
                    {
                        latlng: this.geoLocationService.currentLocation,
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
