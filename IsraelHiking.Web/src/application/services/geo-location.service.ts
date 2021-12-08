import { Injectable, EventEmitter, NgZone } from "@angular/core";
import { BackgroundGeolocationPlugin, Location } from "cordova-background-geolocation-plugin";

import { ResourcesService } from "./resources.service";
import { RunningContextService } from "./running-context.service";
import { LoggingService } from "./logging.service";
import { ToastService } from "./toast.service";
import { NgRedux } from "../reducers/infra/ng-redux.module";
import { SetCurrentPositionAction, SetTrackingStateAction } from "../reducers/gps.reducer";
import type { ApplicationState, LatLngAltTime } from "../models/models";

declare let BackgroundGeolocation: BackgroundGeolocationPlugin;

@Injectable()
export class GeoLocationService {
    private static readonly TIME_OUT = 30000;
    private static readonly SHORT_TIME_OUT = 10000; // Only for first position for good UX

    private watchNumber: number;
    private isBackground: boolean;
    private wasInitialized: boolean;

    public bulkPositionChanged: EventEmitter<GeolocationPosition[]>;

    constructor(private readonly resources: ResourcesService,
                private readonly runningContextService: RunningContextService,
                private readonly loggingService: LoggingService,
                private readonly toastService: ToastService,
                private readonly ngZone: NgZone,
                private readonly ngRedux: NgRedux<ApplicationState>) {
        this.watchNumber = -1;
        this.bulkPositionChanged = new EventEmitter<GeolocationPosition[]>();
        this.isBackground = false;
        this.wasInitialized = false;
    }

    public initialize() {
        if (this.ngRedux.getState().gpsState.tracking === "tracking") {
            this.ngRedux.dispatch(new SetTrackingStateAction({ state: "disabled"}));
            this.enable();
        }
    }

    public async uninitialize() {
        let stateBefore = this.ngRedux.getState().gpsState.tracking;
        await this.disable();
        this.ngRedux.dispatch(new SetTrackingStateAction({ state: stateBefore}));
    }

    public enable() {
        switch (this.ngRedux.getState().gpsState.tracking) {
            case "disabled":
                this.startWatching();
                return;
            case "searching":
            case "tracking":
                return;

        }
    }

    public async disable() {
        switch (this.ngRedux.getState().gpsState.tracking) {
            case "disabled":
                return;
            case "searching":
            case "tracking":
                await this.stopWatching();
                return;
        }
    }

    public canRecord(): boolean {
        let gpsState = this.ngRedux.getState().gpsState;
        return gpsState.tracking === "tracking"
            && gpsState.currentPoistion != null && this.runningContextService.isCordova;
    }

    private startWatching() {
        this.ngRedux.dispatch(new SetTrackingStateAction({ state: "searching"}));
        if (window.navigator && window.navigator.geolocation) {
            // Upon starting location watching get the current position as fast as we can, even if not accurate.
            window.navigator.geolocation.getCurrentPosition((position: GeolocationPosition) => {
                this.handlePoistionChange(position);
            }, () => {}, { timeout: GeoLocationService.SHORT_TIME_OUT });
        }
        if (this.runningContextService.isCordova) {
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
            (position: GeolocationPosition): void => this.handlePoistionChange(position),
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

    private startBackgroundGeolocation() {
        if (this.wasInitialized) {
            BackgroundGeolocation.start();
            return;
        }
        this.loggingService.info("[GeoLocation] Starting background tracking");
        this.wasInitialized = true;
        BackgroundGeolocation.configure({
            locationProvider: BackgroundGeolocation.RAW_PROVIDER,
            desiredAccuracy: BackgroundGeolocation.HIGH_ACCURACY,
            stationaryRadius: 10,
            distanceFilter: 5,
            notificationTitle: this.resources.israelHikingMap,
            notificationText: this.resources.runningInBackground,
            interval: 1000,
            fastestInterval: 1000,
            activitiesInterval: 10000,
            startForeground: true,
            notificationIconLarge: "screen",
            notificationIconSmall: "screen",
        });

        BackgroundGeolocation.on("location").subscribe(async (_: Location) => {
            if (this.isBackground) {
                return;
            }
            await this.onLocationUpdate();
        });

        BackgroundGeolocation.on("start").subscribe(
            () => {
                this.loggingService.debug("[GeoLocation] Start service");
            });

        BackgroundGeolocation.on("stop").subscribe(
            () => {
                this.loggingService.debug("[GeoLocation] Stop service");
            });

        BackgroundGeolocation.on("background").subscribe(
            () => {
                this.isBackground = true;
                this.loggingService.debug("[GeoLocation] Now in background");
            });

        BackgroundGeolocation.on("foreground").subscribe(
            async () => {
                this.loggingService.debug("[GeoLocation] Now in foreground");
                this.isBackground = false;
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
        BackgroundGeolocation.start();
    }

    private async onLocationUpdate() {
        let locations = await BackgroundGeolocation.getValidLocationsAndDelete();
        let positions = locations.map(l => this.locationToPosition(l));
        if (positions.length === 0) {
            this.loggingService.debug("[GeoLocation] There's nothing to send - valid locations array is empty");
        } else if (positions.length === 1) {
            this.handlePoistionChange(positions[positions.length - 1]);
        } else {
            this.loggingService.debug(`[GeoLocation] Sending bulk location update: ${positions.length}`);
            this.bulkPositionChanged.next(positions.splice(0, positions.length - 1));
            this.handlePoistionChange(positions[0]);
        }
    }

    private async stopWatching() {
        this.ngRedux.dispatch(new SetTrackingStateAction({ state: "disabled"}));
        this.ngRedux.dispatch(new SetCurrentPositionAction({position: null}));
        if (this.runningContextService.isCordova) {
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

    private handlePoistionChange(position: GeolocationPosition): void {
        this.ngZone.run(() => {
            this.loggingService.debug("[GeoLocation] Received position: " + JSON.stringify(this.positionToLatLngTime(position)));
            if (this.ngRedux.getState().gpsState.tracking === "searching") {
                this.ngRedux.dispatch(new SetTrackingStateAction({ state: "tracking"}));
            }
            if (this.ngRedux.getState().gpsState.tracking !== "tracking") {
                return;
            }
            this.ngRedux.dispatch(new SetCurrentPositionAction({position}));
        });
    }

    public positionToLatLngTime(position: GeolocationPosition): LatLngAltTime {
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
        let logEntries = await BackgroundGeolocation.getLogEntries(10000, 0, BackgroundGeolocation.LOG_TRACE);
        return logEntries.map(logLine => {
            let dateString = new Date(logLine.timestamp - new Date().getTimezoneOffset() * 60 * 1000)
                .toISOString().replace(/T/, " ").replace(/\..+/, "");
            return dateString + " | " + logLine.level.padStart(5).toUpperCase() + " | " + logLine.message;
        }).join("\n");
    }
}
