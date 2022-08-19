import { Injectable, EventEmitter, NgZone } from "@angular/core";
import { BackgroundGeolocationPlugin, Location } from "@capacitor-community/background-geolocation";
import { App } from "@capacitor/app";
import { NgRedux } from "@angular-redux2/store";
import { registerPlugin } from "@capacitor/core";

import { ResourcesService } from "./resources.service";
import { RunningContextService } from "./running-context.service";
import { LoggingService } from "./logging.service";
import { ToastService } from "./toast.service";
import { SetCurrentPositionAction, SetTrackingStateAction } from "../reducers/gps.reducer";
import type { ApplicationState, LatLngAltTime } from "../models/models";

const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>("BackgroundGeolocation");

@Injectable()
export class GeoLocationService {
    private static readonly TIME_OUT = 30000;
    private static readonly SHORT_TIME_OUT = 10000; // Only for first position for good UX

    private watchNumber: number;
    private bgWatcherId: string;
    private isBackground: boolean;
    // HM TODO: this is a naive implementation - in memory only, will not withstand app crash...
    private bgPositions: GeolocationPosition[];

    public bulkPositionChanged: EventEmitter<GeolocationPosition[]>;
    public backToForeground: EventEmitter<void>;

    constructor(private readonly resources: ResourcesService,
                private readonly runningContextService: RunningContextService,
                private readonly loggingService: LoggingService,
                private readonly toastService: ToastService,
                private readonly ngZone: NgZone,
                private readonly ngRedux: NgRedux<ApplicationState>) {
        this.watchNumber = -1;
        this.bgWatcherId = null;
        this.backToForeground = new EventEmitter();
        this.bulkPositionChanged = new EventEmitter<GeolocationPosition[]>();
        this.isBackground = false;
        this.bgPositions = [];
    }

    public initialize() {
        if (this.ngRedux.getState().gpsState.tracking !== "disabled") {
            this.ngRedux.dispatch(new SetTrackingStateAction({ state: "disabled"}));
            this.enable();
        }

        App.addListener("appStateChange", (state) => {
            if (this.ngRedux.getState().gpsState.tracking === "disabled") {
                return;
            }
            this.isBackground = !state.isActive;
            this.loggingService.debug(`[GeoLocation] Now in ${this.isBackground ? "back" : "fore"}ground`);
            if (state.isActive) {
                this.ngZone.run(() => {
                    this.onLocationUpdate();
                    this.backToForeground.next();
                });
            }
        });
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
            && gpsState.currentPoistion != null && this.runningContextService.isCapacitor;
    }

    private startWatching() {
        this.ngRedux.dispatch(new SetTrackingStateAction({ state: "searching"}));
        if (window.navigator && window.navigator.geolocation) {
            // Upon starting location watching get the current position as fast as we can, even if not accurate.
            window.navigator.geolocation.getCurrentPosition((position: GeolocationPosition) => {
                this.handlePoistionChange(position);
            }, () => {}, { timeout: GeoLocationService.SHORT_TIME_OUT });
        }
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

    private async startBackgroundGeolocation() {
        if (this.bgWatcherId) {
            return;
        }
        this.loggingService.info("[GeoLocation] Starting background tracking");
        this.bgWatcherId = await BackgroundGeolocation.addWatcher({
            backgroundTitle: "Israel Hiking Map",
            backgroundMessage: this.resources.runningInBackground,
            distanceFilter: 5
        }, (location) => {
            this.storeLocationForLater(this.locationToPosition(location));
            if (this.isBackground) {
                return;
            }
            this.ngZone.run(() => {
                this.onLocationUpdate();
            });
        });
    }

    private onLocationUpdate() {
        let positions = this.getValidPositionsAndDelete();
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
        if (this.runningContextService.isCapacitor && this.bgWatcherId) {
            this.loggingService.debug("[GeoLocation] Stopping background tracking");
            await BackgroundGeolocation.removeWatcher({id: this.bgWatcherId});
            this.bgWatcherId = "";
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
        this.loggingService.debug("[GeoLocation] Received position: " + JSON.stringify(this.positionToLatLngTime(position)));
        this.ngZone.run(() => {
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

    private storeLocationForLater(position: GeolocationPosition) {
        this.bgPositions.push(position);
    }

    private getValidPositionsAndDelete(): GeolocationPosition[] {
        return this.bgPositions.splice(0);
    }
}
