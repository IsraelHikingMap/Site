import { Injectable } from "@angular/core";
import { MapBrowserEvent, interaction, Feature, geom } from "openlayers";
import { MatDialog } from "@angular/material";
import { NgRedux } from "@angular-redux/store";

import { ApplicationState, RouteData, MarkerData, LatLngAlt, } from "../../models/models";
import { AddPrivatePoiAction, UpdatePrivatePoiAction } from "../../reducres/routes.reducer";
import { SelectedRouteService } from "../../services/layers/routelayers/selected-route.service";
import { SpatialService } from "../../services/spatial.service";
import { PrivatePoiEditDialogComponent } from "../dialogs/private-poi-edit-dialog.component";

const MARKER = "_marker_";

@Injectable()
export class RouteEditPoiInteraction extends interaction.Interaction {

    private dragging: boolean;
    private selectedMarker: Feature;

    constructor(private readonly matDialog: MatDialog,
        private readonly selectedRouteService: SelectedRouteService,
        private readonly ngRedux: NgRedux<ApplicationState>) {
        super({
            handleEvent: (e) => {
                switch (e.type) {
                    case "pointerdown":
                        return this.handleDown(e);
                    case "pointerdrag":
                        return this.handleDrag(e);
                    case "pointerup":
                        return this.handleUp(e);
                    default:
                        return true;
                }
            }
        });
        this.dragging = false;
    }

    private handleDown(event) {
        // HM TODO: snap to exiting pois
        this.dragging = false;
        let features = (event.map.getFeaturesAtPixel(event.pixel) || []).filter(f =>
            f.getId() &&
            ((f as Feature).getId() as string).indexOf(MARKER) !== -1 &&
            f.getGeometry() instanceof geom.Point);
        this.selectedMarker = features.length > 0 ? features[0] : null;
        return this.selectedMarker == null;
    }

    private handleDrag(event) {
        this.dragging = true;
        if (this.selectedMarker == null) {
            return true;
        }
        let selectedRoute = this.selectedRouteService.getSelectedRoute();
        if (!(this.selectedMarker.getId() as string).startsWith(selectedRoute.id)) {
            return true;
        }
        let point = (this.selectedMarker.getGeometry() as geom.Point);
        point.setCoordinates(event.coordinate);
        this.selectedMarker.setGeometry(point);
        return false;
    }

    private handleUp(event: MapBrowserEvent) {
        if (this.selectedMarker == null && this.dragging) {
            // regular map pan
            return true;
        }
        let latlng = SpatialService.screenToLatLng(event.coordinate);
        if (this.selectedMarker == null && !this.dragging) {
            // click on nothing - add poi
            this.addPrivatePoi(latlng);
            return true;
        }
        let splitStr = (this.selectedMarker.getId() as string).split(MARKER);
        let routeData = this.selectedRouteService.getSelectedRoute();
        let index = +splitStr[1];
        if (!this.dragging) {
            // click on exiting poi
            this.openEditMarkerDialog(routeData.markers[index], routeData.id, index);
            return true;
        }
        // drag exiting poi
        let markerData = { ...routeData.markers[index] } as MarkerData;
        markerData.latlng = latlng;
        this.ngRedux.dispatch(new UpdatePrivatePoiAction({
            routeId: splitStr[0],
            index: index,
            markerData: markerData
        }));
        return true;
    }

    public static createMarkerId(route: RouteData, index: number) {
        return route.id + MARKER + index;
    }

    private openEditMarkerDialog(marker: MarkerData, routeId: string, index: number) {
        let dialogRef = this.matDialog.open(PrivatePoiEditDialogComponent);
        dialogRef.componentInstance.setMarkerAndRoute(marker, routeId, index);
    }

    private addPrivatePoi(latlng: LatLngAlt) {
        this.ngRedux.dispatch(new AddPrivatePoiAction({
            routeId: this.selectedRouteService.getSelectedRoute().id,
            markerData: {
                latlng: latlng,
                urls: [],
                title: "",
                description: "",
                type: "star"
            }
        }));
        let selectedRoute = this.selectedRouteService.getSelectedRoute();
        let index = selectedRoute.markers.length - 1;
        this.openEditMarkerDialog(selectedRoute.markers[index], selectedRoute.id, index);
    }
}