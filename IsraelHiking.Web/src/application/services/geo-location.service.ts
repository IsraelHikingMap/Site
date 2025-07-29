import { Injectable, EventEmitter, NgZone, inject } from "@angular/core";
import { BackgroundGeolocation, Location } from "@capgo/background-geolocation";
import { App } from "@capacitor/app";
import { Store } from "@ngxs/store";

import { ResourcesService } from "./resources.service";
import { RunningContextService } from "./running-context.service";
import { LoggingService } from "./logging.service";
import { ToastService } from "./toast.service";
import { SpatialService } from "./spatial.service";
import { SelectedRouteService } from "./selected-route.service";
import { AudioPlayerFactory, IAudioPlayer } from "./audio-player.factory";
import { SetCurrentPositionAction, SetTrackingStateAction } from "../reducers/gps.reducer";
import type { ApplicationState, LatLngAltTime } from "../models/models";

@Injectable()
export class GeoLocationService {
    private watchId: string = null;
    private isBackground = false;
    private locations: Location[] = [];
    private audioPlayer: IAudioPlayer;
    private isCloseToRoute = false;

    public bulkPositionChanged = new EventEmitter<GeolocationPosition[]>();
    public backToForeground = new EventEmitter<void>();

    private readonly resources = inject(ResourcesService);
    private readonly selectedRouteService = inject(SelectedRouteService);
    private readonly runningContextService = inject(RunningContextService);
    private readonly loggingService = inject(LoggingService);
    private readonly toastService = inject(ToastService);
    private readonly ngZone = inject(NgZone);
    private readonly audioPlayerFactory = inject(AudioPlayerFactory);
    private readonly store = inject(Store);

    public static positionToLatLngTime(position: GeolocationPosition): LatLngAltTime {
        if (position == null) {
            return null;
        }
        return {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            alt: position.coords.altitude,
            timestamp: new Date(position.timestamp)
        };
    }

    public async initialize() {
        if (this.store.selectSnapshot((s: ApplicationState) => s.gpsState).tracking !== "disabled") {
            this.store.dispatch(new SetTrackingStateAction("disabled"));
            this.enable();
        }

        this.audioPlayer = await this.audioPlayerFactory.create();

        if (!this.runningContextService.isCapacitor) {
            return;
        }

        App.addListener("appStateChange", (state) => {
            if (this.store.selectSnapshot((s: ApplicationState) => s.gpsState).tracking === "disabled") {
                return;
            }
            this.isBackground = !state.isActive;
            this.loggingService.debug(`[GeoLocation] Now in ${this.isBackground ? "back" : "fore"}ground`);
            if (this.isBackground && 
                !this.store.selectSnapshot((s: ApplicationState) => s.recordedRouteState).isRecording && 
                !this.store.selectSnapshot((s: ApplicationState) => s.configuration).isGotLostWarnings &&
                this.watchId) {
                BackgroundGeolocation.removeWatcher({id: this.watchId});
                this.watchId = null;
                return;
            }
            if (!this.isBackground &&
                !this.store.selectSnapshot((s: ApplicationState) => s.recordedRouteState).isRecording &&
                !this.store.selectSnapshot((s: ApplicationState) => s.configuration).isGotLostWarnings &&
                this.watchId == null) {
                this.startWatching();
            }
            if (!this.isBackground) {
                this.ngZone.run(async () => {
                    await this.onLocationUpdate();
                    this.backToForeground.next();
                });
            }
        });
    }

    public async uninitialize() {
        const stateBefore = this.store.selectSnapshot((s: ApplicationState) => s.gpsState).tracking;
        await this.disable();
        this.store.dispatch(new SetTrackingStateAction(stateBefore));
    }

    public enable() {
        switch (this.store.selectSnapshot((s: ApplicationState) => s.gpsState).tracking) {
            case "disabled":
                this.startWatching();
                return;
            case "searching":
            case "tracking":
                return;

        }
    }

    public async disable() {
        switch (this.store.selectSnapshot((s: ApplicationState) => s.gpsState).tracking) {
            case "disabled":
                return;
            case "searching":
            case "tracking":
                await this.stopWatching();
                return;
        }
    }

    private startWatching() {
        this.store.dispatch(new SetTrackingStateAction("searching"));
        this.startBackgroundGeolocation();
    }

    private async startBackgroundGeolocation() {
        if (this.watchId) {
            this.loggingService.debug("[GeoLocation] Background tracking already started, skipping...");
            return;
        }
        this.loggingService.info("[GeoLocation] Starting background tracking");
        try {
            this.watchId = await BackgroundGeolocation.addWatcher({
                backgroundMessage:  this.resources.runningInBackground,
                backgroundTitle: "Israel Hiking Map",
                requestPermissions: true,
                stale: true,
                distanceFilter: 2
            }, (location?: Location, error?: Error) => {
                if (error) {
                    this.loggingService.error("[GeoLocation] Failed to start background tracking: " + error.message);
                    this.disable();
                    this.toastService.confirm({
                        message: this.resources.noLocationPermissionOpenAppSettings,
                        type: "OkCancel",
                        confirmAction: () => BackgroundGeolocation.openSettings(),
                        declineAction: () => { }
                    });
                    return;
                }
                this.locations.push(location);
                this.loggingService.debug("[GeoLocation] Received position: " + `lat: ${location.latitude}, lng: ${location.longitude}, time: ${new Date(location.time).toISOString()}, accuracy: ${location.accuracy}, background: ${this.isBackground}`);
                this.playOffRouteSoundIfNeeded(location);
                if (this.isBackground) {
                    return;
                }
                this.onLocationUpdate();
            });
        } catch { 
            // ignore errors.
        }
    }

    private playOffRouteSoundIfNeeded(location: Location) {
        if (!this.store.selectSnapshot((s: ApplicationState) => s.configuration).isGotLostWarnings) {
            return;
        }
        const currentLocation = GeoLocationService.positionToLatLngTime(this.locationToPosition(location));
        const closestRouteToGps = this.selectedRouteService.getClosestRouteToGPS(currentLocation, location.speed === 0 ? null : location.bearing);
        const isPreviousCloseToRoute = this.isCloseToRoute;
        this.isCloseToRoute = closestRouteToGps != null;
        if (this.isCloseToRoute === false && isPreviousCloseToRoute === true) {
            if (navigator.vibrate) {
                navigator.vibrate([200, 100, 200]);
            }
            this.audioPlayer.play();
        }
    }

    private async onLocationUpdate() {
        const locations = [...this.locations];
        this.locations = [];
        const positions = locations.map(l => this.locationToPosition(l)).filter(p => !SpatialService.isJammingTarget(GeoLocationService.positionToLatLngTime(p)));
        this.loggingService.debug("[GeoLocation] Handle location update, received " + positions.length + " positions");
        if (positions.length === 1) {
            this.handlePositionChange(positions[0]);
        } else if (positions.length > 1) {
            this.bulkPositionChanged.next(positions.splice(0, positions.length - 1));
            this.handlePositionChange(positions[0]);
        }
    }

    private async stopWatching() {
        this.store.dispatch(new SetTrackingStateAction("disabled"));
        this.store.dispatch(new SetCurrentPositionAction(null));
        if (this.watchId) {
            this.loggingService.debug("[GeoLocation] Stopping background tracking");
            await BackgroundGeolocation.removeWatcher({id: this.watchId});
            this.watchId = null;
        }
    }

    private handlePositionChange(position: GeolocationPosition): void {
        const latLng = GeoLocationService.positionToLatLngTime(position);
        if (SpatialService.isJammingTarget(latLng)) {
            this.toastService.info(this.resources.jammedPositionReceived);
            return;
        }
        if (this.store.selectSnapshot((s: ApplicationState) => s.gpsState).tracking === "searching") {
            this.store.dispatch(new SetTrackingStateAction("tracking"));
        }
        if (this.store.selectSnapshot((s: ApplicationState) => s.gpsState).tracking !== "tracking") {
            return;
        }
        this.store.dispatch(new SetCurrentPositionAction(position));
    }

    private locationToPosition(location: Location): GeolocationPosition {
        return {
            coords: {
                accuracy: location.accuracy,
                altitude: location.altitude,
                latitude: location.latitude,
                longitude: location.longitude,
                speed: location.speed,
                heading: location.bearing
            },
            timestamp: location.time
        } as GeolocationPosition;
    }
}
