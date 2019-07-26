import { Injectable, EventEmitter, NgZone } from "@angular/core";
import { BackgroundGeolocationPlugin, Location } from "@mauron85/cordova-plugin-background-geolocation";

import { ResourcesService } from "./resources.service";
import { RunningContextService } from "./running-context.service";
import { SpatialService } from "./spatial.service";
import { LoggingService } from "./logging.service";
import { ILatLngTime } from "../models/models";

declare type GeoLocationServiceState = "disabled" | "searching" | "tracking";

declare var BackgroundGeolocation: BackgroundGeolocationPlugin;

@Injectable()
export class GeoLocationService {
    private static readonly TIME_OUT = 30000;
    private static readonly MAX_TIME_DIFFERENCE = 60; // seconds
    private static readonly MAX_SPPED = 55; // meters / seconds =~ 200 Km/hs
    private static readonly MIN_ACCURACY = 50; // meters

    private state: GeoLocationServiceState;
    private watchNumber: number;
    private isBackground: boolean;
    private rejectedPosition: ILatLngTime;
    private wasInitialized: boolean;

    public positionChanged: EventEmitter<Position>;
    public currentLocation: ILatLngTime;

    constructor(private readonly resources: ResourcesService,
                private readonly runningContextService: RunningContextService,
                private readonly loggingService: LoggingService,
                private readonly ngZone: NgZone) {
        this.watchNumber = -1;
        this.positionChanged = new EventEmitter<Position>();
        this.state = "disabled";
        this.currentLocation = null;
        this.isBackground = false;
        this.rejectedPosition = null;
        this.wasInitialized = false;
    }

    public getState(): GeoLocationServiceState {
        return this.state;
    }

    public enable() {
        switch (this.state) {
            case "disabled":
                this.startWatching();
                return;
            case "searching":
            case "tracking":
                return;

        }
    }

    public disable() {
        switch (this.state) {
            case "disabled":
                return;
            case "searching":
            case "tracking":
                this.stopWatching();
                return;
        }
    }

    public canRecord(): boolean {
        return this.state === "tracking" && this.currentLocation != null && this.runningContextService.isCordova;
    }

    private startWatching() {
        this.state = "searching";
        if (this.runningContextService.isCordova) {
            this.startBackgroundGeolocation();

        } else {
            this.startNavigator();
        }
    }

    private startNavigator() {
        this.loggingService.debug("Starting browser geo-location");
        if (!window.navigator || !window.navigator.geolocation) {
            return;
        }
        if (this.watchNumber !== -1) {
            return;
        }
        this.watchNumber = window.navigator.geolocation.watchPosition(
            (position: Position): void => this.handlePoistionChange(position),
            (err) => {
                this.ngZone.run(() => {
                    // sending error will terminate the stream
                    this.loggingService.error("Failed to start tracking " + JSON.stringify(err));
                    this.positionChanged.next(null);
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
        this.wasInitialized = true;
        BackgroundGeolocation.configure({
            locationProvider: BackgroundGeolocation.RAW_PROVIDER,
            desiredAccuracy: BackgroundGeolocation.HIGH_ACCURACY,
            stationaryRadius: 10,
            distanceFilter: 5,
            notificationTitle: this.resources.israelHikingMap,
            notificationText: this.resources.runningInBackground,
            debug: false,
            interval: 1000,
            fastestInterval: 1000,
            activitiesInterval: 10000,
            startForeground: true
        });

        BackgroundGeolocation.on("location", (location: Location) => {
            let position = {
                coords: {
                    accuracy: location.accuracy,
                    altitude: location.altitude,
                    latitude: location.latitude,
                    longitude: location.longitude,
                    speed: location.speed,
                    heading: location.bearing
                },
                timestamp: location.time
            } as Position;
            this.handlePoistionChange(position);
        });

        BackgroundGeolocation.on("authorization", status => {
            if (status !== BackgroundGeolocation.AUTHORIZED) {
                // we need to set delay or otherwise alert may not be shown
                setTimeout(() => {
                    let showSettings = confirm("App requires location tracking permission. Would you like to open app settings?");
                    if (showSettings) {
                        return BackgroundGeolocation.showAppSettings();
                    }
                }, 1000);
            }
        });

        BackgroundGeolocation.on("start",
            () => {
                this.loggingService.debug("Start geo-location service");
            });

        BackgroundGeolocation.on("stop",
            () => {
                this.loggingService.debug("Stop geo-location service");
            });

        BackgroundGeolocation.on("background",
            () => {
                this.isBackground = true;
                this.loggingService.debug("geo-location now in background");
            });

        BackgroundGeolocation.on("foreground",
            () => {
                this.isBackground = false;
                this.loggingService.debug("geo-location now in foreground");
            });
        BackgroundGeolocation.start();
    }

    private stopWatching() {
        this.state = "disabled";
        this.currentLocation = null;
        if (this.runningContextService.isCordova) {
            this.stopBackgroundGeolocation();
        } else {
            this.stopNavigator();
        }
    }

    private stopNavigator() {
        this.loggingService.debug("Stopping browser geo-location: " + this.watchNumber);
        if (this.watchNumber !== -1) {
            window.navigator.geolocation.clearWatch(this.watchNumber);
            this.watchNumber = -1;
        }
    }

    private stopBackgroundGeolocation() {
        this.loggingService.debug("Stopping background geo-location");
        BackgroundGeolocation.stop();
    }

    private handlePoistionChange(position: Position): void {
        this.ngZone.run(() => {
            this.loggingService.debug("geo-location received, bg: " + this.isBackground +
                " p: " + JSON.stringify(this.positionToLatLngTime(position)));
            if (this.state === "searching") {
                this.state = "tracking";
            }
            if (this.state !== "tracking") {
                return;
            }
            this.validRecordingAndUpdate(position);
        });
    }

    private validRecordingAndUpdate(position: Position) {
        if (this.currentLocation == null) {
            this.loggingService.debug("Adding the first position: " + JSON.stringify(this.positionToLatLngTime(position)));
            this.updatePositionAndRaiseEvent(position);
            return;
        }
        let nonValidReason = this.isValid(this.currentLocation, position);
        if (nonValidReason === "") {
            this.updatePositionAndRaiseEvent(position);
            return;
        }
        if (this.rejectedPosition == null) {
            this.rejectedPosition = this.positionToLatLngTime(position);
            this.loggingService.debug("Rejecting position: " + JSON.stringify(this.positionToLatLngTime(position)) +
                " reason:" + nonValidReason);
            return;
        }
        nonValidReason = this.isValid(this.rejectedPosition, position);
        if (nonValidReason === "") {
            this.loggingService.debug("Validating a rejected position: " + JSON.stringify(this.positionToLatLngTime(position)));
            this.updatePositionAndRaiseEvent(position);
            return;
        }
        this.rejectedPosition = this.positionToLatLngTime(position);
        this.loggingService.debug("Rejecting position for rejected: " + JSON.stringify(position) + " reason: " + nonValidReason);
    }

    private isValid(test: ILatLngTime, position: Position): string {
        let distance = SpatialService.getDistanceInMeters(test, this.positionToLatLngTime(position));
        let timeDifference = Math.abs(position.timestamp - test.timestamp.getTime()) / 1000;
        if (timeDifference === 0) {
            return "Time difference is 0";
        }
        if (distance / timeDifference > GeoLocationService.MAX_SPPED) {
            return "Speed too high: " + distance / timeDifference;
        }
        if (timeDifference > GeoLocationService.MAX_TIME_DIFFERENCE) {
            return "Time difference too high: " + timeDifference;
        }
        if (position.coords.accuracy > GeoLocationService.MIN_ACCURACY) {
            return "Accuracy too low: " + position.coords.accuracy;
        }
        return "";
    }

    private updatePositionAndRaiseEvent(position: Position) {
        this.currentLocation = this.positionToLatLngTime(position);
        this.rejectedPosition = null;
        this.positionChanged.next(position);
        this.loggingService.debug("Valid position, updating: (" + position.coords.latitude + ", " + position.coords.longitude + ")");
    }

    private positionToLatLngTime(position: Position): ILatLngTime {
        return {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            alt: position.coords.altitude,
            timestamp: new Date(position.timestamp)
        };
    }
}
