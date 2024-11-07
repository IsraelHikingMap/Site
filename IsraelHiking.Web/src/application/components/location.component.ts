import { Component, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { MapComponent } from "@maplibre/ngx-maplibre-gl";
import { Store } from "@ngxs/store";

import { ResourcesService } from "../services/resources.service";
import { ToastService } from "../services/toast.service";
import { SelectedRouteService } from "../services/selected-route.service";
import { SpatialService } from "../services/spatial.service";
import { RecordedRouteService } from "../services/recorded-route.service";
import { LocationService } from "../services/location.service";
import { ToggleDistanceAction, SetPannedAction, SetFollowingAction, ToggleKeepNorthUpAction } from "../reducers/in-memory.reducer";
import { StopShowingBatteryConfirmationAction } from "../reducers/configuration.reducer";
import { ChangeRouteStateAction } from "../reducers/routes.reducer";
import { ToggleAddRecordingPoiAction } from "../reducers/recorded-route.reducer";
import type { LatLngAlt, ApplicationState } from "../models/models";

@Component({
    selector: "location",
    templateUrl: "./location.component.html",
    styleUrls: ["./location.component.scss"]
})
export class LocationComponent {
    public locationFeatures: GeoJSON.FeatureCollection<GeoJSON.Geometry>;
    public distanceFeatures: GeoJSON.FeatureCollection<GeoJSON.Geometry>;
    public locationLatLng: LatLngAlt = null;
    public showDistance: boolean = false;

    public readonly resources = inject(ResourcesService);
    private readonly toastService = inject(ToastService);
    private readonly locationSerivce = inject(LocationService);
    private readonly selectedRouteService = inject(SelectedRouteService);
    private readonly recordedRouteService = inject(RecordedRouteService);
    private readonly store = inject(Store);
    private readonly mapComponent = inject(MapComponent);

    constructor() {
        this.clearLocationFeatureCollection();

        this.locationSerivce.changed.pipe(takeUntilDestroyed()).subscribe(location => {
            if (location == null) {
                this.clearLocationFeatureCollection();
                return;
            }
            this.updateLocationFeatureCollection(location.center, location.accuracy, location.bearing);
            if (this.locationSerivce.isFollowing()) {
                const selectedRoute = this.selectedRouteService.getSelectedRoute();
                if (selectedRoute != null && (selectedRoute.state === "Poi" || selectedRoute.state === "Route")) {
                    this.toastService.warning(this.resources.editingRouteWhileTracking);
                }
            }
        });

        this.store.select((state: ApplicationState) => state.inMemoryState.distance).pipe(takeUntilDestroyed()).subscribe(distance => {
            this.showDistance = distance;
            this.updateDistanceFeatureCollection();
        });

        this.mapComponent.mapLoad.subscribe(() => {
            this.mapComponent.mapInstance.on("move", () => {
                this.updateDistanceFeatureCollection();
            });

            this.mapComponent.mapInstance.on("resize", () => {
                if (this.locationSerivce.isFollowing() && this.locationSerivce.getLocationCenter() != null) {
                    this.mapComponent.mapInstance.setCenter(this.locationSerivce.getLocationCenter());
                }
            });
        });
    }

    public isFollowingLocation(): boolean {
        return this.locationSerivce.isFollowing();
    }

    public openLocationPopup() {
        if (this.locationLatLng != null) {
            this.locationLatLng = null;
            return;
        }
        const selectedRoute = this.selectedRouteService.getSelectedRoute();
        if (selectedRoute != null && selectedRoute.state === "Route") {
            return;
        }
        const center = this.locationSerivce.getLocationCenter();
        if (center !== null) {
            this.locationLatLng = center;
        }
    }

    public isKeepNorthUp() {
        return this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState).keepNorthUp;
    }

    public toggleKeepNorthUp() {
        this.store.dispatch(new ToggleKeepNorthUpAction());
        if (this.isKeepNorthUp()) {
           this.mapComponent.mapInstance.rotateTo(0);
        }
    }

    public getRotationAngle() {
        if (this.mapComponent.mapInstance == null) {
            return "rotate(0deg)";
        }
        return `rotate(${-this.mapComponent.mapInstance.getBearing()}deg)`;
    }

    public toggleTracking() {
        if (this.isLoading()) {
            this.locationSerivce.disable();
            return;
        }
        if (this.isDisabled()) {
            this.locationSerivce.enable();
            return;
        }
        // is active must be true
        if (!this.isFollowingLocation()) {
            this.store.dispatch(new SetFollowingAction(true));
            this.store.dispatch(new SetPannedAction(null));
            if (this.showDistance) {
                this.store.dispatch(new ToggleDistanceAction());
            }
            this.locationSerivce.moveMapToGpsPosition();
            return;
        }
        // following and not panned
        if (this.isRecording()) {
            this.store.dispatch(new SetFollowingAction(false));
            return;
        }
        if (!this.isRecording()) {
            this.locationSerivce.disable();
            return;
        }
    }

    public canRecord() {
        return this.recordedRouteService.canRecord();
    }

    public isRecording() {
        return this.recordedRouteService.isRecording();
    }

    public toggleRecording() {
        if (this.isRecording()) {
            this.toastService.confirm({
                message: this.resources.areYouSureYouWantToStopRecording,
                type: "YesNo",
                confirmAction: () => {
                    this.store.dispatch(new SetFollowingAction(true));
                    this.recordedRouteService.stopRecording();
                }
            });
        } else {
            if (this.store.selectSnapshot((s: ApplicationState) => s.configuration).isShowBatteryConfirmation) {
                this.toastService.confirm({
                    message: this.resources.makeSureBatteryOptimizationIsOff,
                    type: "Custom",
                    declineAction: () => {
                        this.store.dispatch(new StopShowingBatteryConfirmationAction());
                    },
                    customConfirmText: this.resources.ok,
                    customDeclineText: this.resources.dontShowThisMessageAgain
                });
            }
            this.recordedRouteService.startRecording();
        }
    }

    public isDisabled() {
        return this.store.selectSnapshot((s: ApplicationState) => s.gpsState).tracking === "disabled";
    }

    public isActive() {
        return this.store.selectSnapshot((s: ApplicationState) => s.gpsState).tracking === "tracking";
    }

    public isLoading() {
        return this.store.selectSnapshot((s: ApplicationState) => s.gpsState).tracking === "searching";
    }

    public isAddingRecordingPoi() {
        return this.store.selectSnapshot((s: ApplicationState) => s.recordedRouteState).isAddingPoi;
    }

    public toggleAddRecordingPoi() {
        const selectedRoute = this.selectedRouteService.getSelectedRoute();
        if (selectedRoute && (selectedRoute.state === "Poi" || selectedRoute.state === "Route")) {
            this.store.dispatch(new ChangeRouteStateAction(selectedRoute.id, "ReadOnly"));
        }
        this.store.dispatch(new ToggleAddRecordingPoiAction());
    }

    private clearLocationFeatureCollection() {
        this.locationFeatures = {
            type: "FeatureCollection",
            features: []
        };
        this.clearDistanceFeatureCollection();
    }

    private updateLocationFeatureCollection(center: LatLngAlt, radius: number, heading: number) {
        const features: GeoJSON.Feature<GeoJSON.Geometry>[] = [{
            type: "Feature",
            properties: { heading },
            geometry: {
                type: "Point",
                coordinates: SpatialService.toCoordinate(center)
            }
        }];
        if (radius != null) {
            features.push(SpatialService.getCirclePolygonFeature(center, radius));
        }
        this.locationFeatures = {
            type: "FeatureCollection",
            features
        };
        this.updateDistanceFeatureCollection();
    }

    private clearDistanceFeatureCollection() {
        this.distanceFeatures = {
            type: "FeatureCollection",
            features: []
        };
    }

    private updateDistanceFeatureCollection() {
        const gps = this.locationSerivce.getLocationCenter();
        if (!this.isActive() || !this.showDistance || gps == null) {
            this.clearDistanceFeatureCollection();
            return;
        }

        const center = this.mapComponent.mapInstance.getCenter();
        const distance = SpatialService.getDistanceInMeters(center, gps);
        this.distanceFeatures = {
            type: "FeatureCollection",
            features: [{
                type: "Feature",
                properties: {},
                geometry: {
                    type: "LineString",
                    coordinates: [SpatialService.toCoordinate(gps), SpatialService.toCoordinate(center)]
                }
            },
            {
                type: "Feature",
                properties: {
                    distance: (distance / 1000.0).toFixed(2) + " " + this.resources.kmUnit
                },
                geometry: {
                    type: "Point",
                    coordinates: SpatialService.toCoordinate(center)
                }
            }]
        };
    }
}
