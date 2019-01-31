import { Injectable, EventEmitter } from "@angular/core";
import { MapBrowserEvent, interaction, Feature, geom, MapBrowserPointerEvent } from "openlayers";
import { MatDialog } from "@angular/material";
import { NgRedux } from "@angular-redux/store";

import { AddPrivatePoiAction, UpdatePrivatePoiAction } from "../../reducres/routes.reducer";
import { SelectedRouteService } from "../../services/layers/routelayers/selected-route.service";
import { SpatialService } from "../../services/spatial.service";
import { PrivatePoiEditDialogComponent } from "../dialogs/private-poi-edit-dialog.component";
import { GeoLocationService } from "../../services/geo-location.service";
import { SnappingService, ISnappingPointResponse } from "../../services/snapping.service";
import { PointerCounterHelper } from "./pointer-counter.helper";
import { ApplicationState, RouteData, MarkerData, LatLngAlt } from "../../models/models";

const MARKER = "_marker_";

@Injectable()
export class RouteEditPoiInteraction extends interaction.Interaction {

    public onPointerMove: EventEmitter<LatLngAlt>;

    private dragging: boolean;
    private selectedMarker: Feature;
    private pointerCounterHelper: PointerCounterHelper;

    constructor(private readonly matDialog: MatDialog,
        private readonly selectedRouteService: SelectedRouteService,
        private readonly geoLocationService: GeoLocationService,
        private readonly snappingService: SnappingService,
        private readonly ngRedux: NgRedux<ApplicationState>) {
        super({
            handleEvent: (e: MapBrowserPointerEvent) => {
                this.pointerCounterHelper.updatePointers(e);
                switch (e.type) {
                    case "pointerdown":
                        return this.handleDown(e);
                    case "pointerdrag":
                        return this.handleDrag(e);
                    case "pointerup":
                        return this.handleUp(e);
                    case "pointermove":
                        return this.handleMove(e);
                    default:
                        return true;
                }
            }
        });
        this.dragging = false;
        this.pointerCounterHelper = new PointerCounterHelper();
        this.onPointerMove = new EventEmitter();
    }

    public static createMarkerId(route: RouteData, index: number) {
        return route.id + MARKER + index;
    }

    public static getRouteAndMarkerIndex(id: string): { routeId: string, index: number } {
        return {
            routeId: id.split(MARKER)[0],
            index: +id.split(MARKER)[1]
        };
    }

    public static getMarkerFeatures(event: MapBrowserEvent, pixel: [number, number]) {
        return (event.map.getFeaturesAtPixel(pixel) as Feature[] || []).filter(f =>
            f.getId() &&
            f.getId().toString().indexOf(MARKER) !== -1 &&
            f.getGeometry() instanceof geom.Point);
    }

    private handleDown(event: MapBrowserPointerEvent): boolean {
        if (this.pointerCounterHelper.getPointersCount() > 1) {
            this.selectedMarker = null;
            return true;
        }
        this.dragging = false;
        let snapping = this.getSnappingForPoint(SpatialService.fromViewCoordinate(event.coordinate));
        let pixel = event.map.getPixelFromCoordinate(SpatialService.toViewCoordinate(snapping.latlng));
        let features = RouteEditPoiInteraction.getMarkerFeatures(event, pixel);
        this.selectedMarker = null;
        if (features.length === 0) {
            return true;
        }
        let selectedRoute = this.selectedRouteService.getSelectedRoute();
        if (selectedRoute != null &&
            RouteEditPoiInteraction.getRouteAndMarkerIndex(features[0].getId().toString()).routeId !== selectedRoute.id) {
            return true;
        }
        this.selectedMarker = features[0];
        return this.selectedMarker == null;
    }

    private handleDrag(event): boolean {
        this.dragging = true;
        this.onPointerMove.emit(null);
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

    private handleUp(event: MapBrowserPointerEvent): boolean {
        if (this.selectedMarker == null && this.dragging) {
            // regular map pan
            return true;
        }
        let latlng = SpatialService.fromViewCoordinate(event.coordinate);
        if (this.selectedMarker == null && !this.dragging) {
            // click on nothing - add poi
            this.addPrivatePoi(latlng);
            return true;
        }
        let routeAndMarker = RouteEditPoiInteraction.getRouteAndMarkerIndex(this.selectedMarker.getId().toString());
        let routeData = this.selectedRouteService.getSelectedRoute();
        if (!this.dragging) {
            // click on exiting poi
            PrivatePoiEditDialogComponent.openDialog(this.matDialog,
                routeData.markers[routeAndMarker.index],
                routeData.id,
                routeAndMarker.index);
            return true;
        }
        // drag exiting poi
        let markerData = { ...routeData.markers[routeAndMarker.index] } as MarkerData;
        markerData.latlng = latlng;
        this.ngRedux.dispatch(new UpdatePrivatePoiAction({
            routeId: routeAndMarker.routeId,
            index: routeAndMarker.index,
            markerData: markerData
        }));
        return true;
    }

    private handleMove(event: MapBrowserEvent): boolean {
        if (event.dragging) {
            return true;
        }
        let response = this.getSnappingForPoint(SpatialService.fromViewCoordinate(event.coordinate));
        this.onPointerMove.emit(response.latlng);
        return true;
    }

    private addPrivatePoi(latlng: LatLngAlt) {
        let snapping = this.getSnappingForPoint(latlng);
        let markerData = (snapping.markerData != null)
            ? { ...snapping.markerData }
            : {
                latlng: latlng,
                urls: [],
                title: "",
                description: "",
                type: "star"
            };
        this.ngRedux.dispatch(new AddPrivatePoiAction({
            routeId: this.selectedRouteService.getSelectedRoute().id,
            markerData: markerData
        }));
        let selectedRoute = this.selectedRouteService.getSelectedRoute();
        let index = selectedRoute.markers.length - 1;
        PrivatePoiEditDialogComponent.openDialog(this.matDialog, selectedRoute.markers[index], selectedRoute.id, index);
    }

    public getSnappingForPoint(latlng: LatLngAlt): ISnappingPointResponse {
        if (this.geoLocationService.getState() === "tracking") {
            let snappingPointResponse = this.snappingService.snapToPoint(latlng,
                {
                    points: [
                        {
                            latlng: this.geoLocationService.currentLocation,
                            type: "star",
                            urls: [],
                            title: "",
                            description: "",
                        } as MarkerData
                    ],
                    sensitivity: 30
                });
            if (snappingPointResponse.markerData != null) {
                return snappingPointResponse;
            }
        }
        return this.snappingService.snapToPoint(latlng);
    }
}