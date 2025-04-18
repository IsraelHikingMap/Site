import { Injectable, EventEmitter, NgZone, inject } from "@angular/core";
import { BackgroundGeolocationPlugin, Location } from "cordova-background-geolocation-plugin";
import { App } from "@capacitor/app";
import { Store } from "@ngxs/store";

import { ResourcesService } from "./resources.service";
import { RunningContextService } from "./running-context.service";
import { LoggingService } from "./logging.service";
import { ToastService } from "./toast.service";
import { SpatialService } from "./spatial.service";
import { SetCurrentPositionAction, SetTrackingStateAction } from "../reducers/gps.reducer";
import type { ApplicationState, LatLngAltTime } from "../models/models";

declare let BackgroundGeolocation: BackgroundGeolocationPlugin;

@Injectable()
export class GeoLocationService {
    private static readonly TIME_OUT = 30000;
    private static readonly SHORT_TIME_OUT = 10000; // Only for first position for good UX

    private watchNumber = -1;
    private isBackground = false;
    private wasInitialized = false;
    private gettingLocations = false;

    public bulkPositionChanged = new EventEmitter<GeolocationPosition[]>();
    public backToForeground = new EventEmitter<void>();

    private readonly resources = inject(ResourcesService);
    private readonly runningContextService = inject(RunningContextService);
    private readonly loggingService = inject(LoggingService);
    private readonly toastService = inject(ToastService);
    private readonly ngZone = inject(NgZone);
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

    public initialize() {
        if (this.store.selectSnapshot((s: ApplicationState) => s.gpsState).tracking !== "disabled") {
            this.store.dispatch(new SetTrackingStateAction("disabled"));
            this.enable();
        }

        if (!this.runningContextService.isCapacitor) {
            return;
        }

        App.addListener("appStateChange", (state) => {
            if (this.store.selectSnapshot((s: ApplicationState) => s.gpsState).tracking === "disabled") {
                return;
            }
            this.isBackground = !state.isActive;
            this.loggingService.debug(`[GeoLocation] Now in ${this.isBackground ? "back" : "fore"}ground`);
            if (state.isActive) {
                if (!this.store.selectSnapshot((s: ApplicationState) => s.recordedRouteState).isRecording) {
                    this.startWatching();
                }
                this.ngZone.run(async () => {
                    await this.onLocationUpdate();
                    this.backToForeground.next();
                });
            } else if (!this.store.selectSnapshot((s: ApplicationState) => s.recordedRouteState).isRecording) {
                BackgroundGeolocation.stop();
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
        if (this.runningContextService.isCapacitor) {
            this.startBackgroundGeolocation();
        } else {
            this.startNavigator();
        }
    }

    private startNavigator() {
        this.loggingService.info("[GeoLocation] Starting browser tracking");
        if (!window.navigator || !window.navigator.geolocation) {
            return;
        }
        if (this.watchNumber !== -1) {
            return;
        }
        this.watchNumber = window.navigator.geolocation.watchPosition(
            (position: GeolocationPosition): void => this.handlePositionChange(position),
            (err) => {
                this.ngZone.run(() => {
                    this.loggingService.error("[GeoLocation] Failed to start browser tracking " + JSON.stringify(err));
                    this.toastService.warning(this.resources.unableToFindYourLocation);
                    this.disable();
                });
            },
            {
                enableHighAccuracy: true,
                timeout: GeoLocationService.TIME_OUT
            });
    }

    private async startBackgroundGeolocation() {
        if (this.wasInitialized) {
            this.startBackgroundGeolocationWithRoughPosition();
            return;
        }
        this.loggingService.info("[GeoLocation] Initializing background tracking");
        this.wasInitialized = true;
        BackgroundGeolocation.configure({
            locationProvider: BackgroundGeolocation.RAW_PROVIDER,
            desiredAccuracy: BackgroundGeolocation.HIGH_ACCURACY,
            stationaryRadius: 10,
            distanceFilter: 5,
            notificationTitle: "Israel Hiking Map",
            notificationText: this.resources.runningInBackground,
            interval: 1000,
            fastestInterval: 1000,
            activitiesInterval: 10000,
            startForeground: true,
            notificationIconLarge: "bg_notification",
            notificationIconSmall: "bg_notification",
        });

        BackgroundGeolocation.on("location").subscribe(async (_: Location) => {
            if (this.isBackground) {
                return;
            }
            await this.onLocationUpdate();
        });


        BackgroundGeolocation.on("authorization").subscribe(
            (status) => {
                if (status === BackgroundGeolocation.NOT_AUTHORIZED) {
                    this.loggingService.error("[GeoLocation] Failed to start background tracking - unauthorized");
                    this.disable();
                    this.toastService.confirm({
                        message: this.resources.noLocationPermissionOpenAppSettings,
                        type: "OkCancel",
                        confirmAction: () => BackgroundGeolocation.showAppSettings(),
                        declineAction: () => { }
                    });
                }
            });

        BackgroundGeolocation.on("error").subscribe(
            (error) => {
                this.loggingService.error(`[GeoLocation] Failed to start background tracking ${error.message}`);
                this.toastService.warning(this.resources.unableToFindYourLocation);
                this.disable();
            });
        
        this.startBackgroundGeolocationWithRoughPosition();
    }

    private async startBackgroundGeolocationWithRoughPosition() {
        this.loggingService.info("[GeoLocation] Starting background tracking");
        BackgroundGeolocation.start();

        if (window.navigator?.geolocation == null) {
            return;
        }
        const status = await BackgroundGeolocation.checkStatus();
        if (status.authorization === BackgroundGeolocation.NOT_AUTHORIZED) {
            return;
        }
        window.navigator.geolocation.getCurrentPosition((position: GeolocationPosition) => {
            // Upon starting location watching get the current position as fast as we can, even if not accurate, only update if we didn't reveice a location already.
            if (this.store.selectSnapshot((s: ApplicationState) => s.gpsState).tracking === "searching") {
                this.handlePositionChange(position);
            }
        }, () => {}, { timeout: GeoLocationService.SHORT_TIME_OUT });
    }

    private async onLocationUpdate() {
        if (this.gettingLocations) {
            this.loggingService.debug("[GeoLocation] Trying to get locations while already getting them, skipping...");
            return;
        }
        this.gettingLocations = true;
        const locations = await BackgroundGeolocation.getValidLocationsAndDelete();
        this.gettingLocations = false;
        const positions = locations.map(l => this.locationToPosition(l)).filter(p => !SpatialService.isJammingTarget(GeoLocationService.positionToLatLngTime(p)));
        if (positions.length === 0) {
            this.loggingService.debug("[GeoLocation] There's nothing to send - valid locations array is empty");
        } else if (positions.length === 1) {
            this.handlePositionChange(positions[0]);
        } else {
            this.loggingService.debug(`[GeoLocation] Sending bulk location update: ${positions.length}`);
            this.bulkPositionChanged.next(positions.splice(0, positions.length - 1));
            this.handlePositionChange(positions[0]);
        }
    }

    private async stopWatching() {
        this.store.dispatch(new SetTrackingStateAction("disabled"));
        this.store.dispatch(new SetCurrentPositionAction(null));
        if (this.runningContextService.isCapacitor) {
            this.loggingService.debug("[GeoLocation] Stopping background tracking");
            await BackgroundGeolocation.stop();
        } else {
            this.loggingService.debug("[GeoLocation] Stopping browser tracking: " + this.watchNumber);
            this.stopNavigator();
        }
    }

    private stopNavigator() {
        if (this.watchNumber !== -1) {
            this.loggingService.info("[GeoLocation] Stopping browser tracking");
            window.navigator.geolocation.clearWatch(this.watchNumber);
            this.watchNumber = -1;
        }
    }

    private handlePositionChange(position: GeolocationPosition): void {
        const latLng = GeoLocationService.positionToLatLngTime(position);
        this.loggingService.debug("[GeoLocation] Received position: " + JSON.stringify(latLng));
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

    public async getLog(): Promise<string> {
        const logEntries = await BackgroundGeolocation.getLogEntries(10000, 0, BackgroundGeolocation.LOG_TRACE);
        return logEntries.map((logLine) => {
            const dateString = new Date(logLine.timestamp - new Date().getTimezoneOffset() * 60 * 1000)
                .toISOString().replace(/T/, " ").replace(/\..+/, "");
            return dateString + " | " + logLine.level.padStart(5).toUpperCase() + " | " + logLine.message;
        }).join("\n");
    }
}
