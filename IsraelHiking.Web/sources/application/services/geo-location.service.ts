import { Injectable, EventEmitter, NgZone } from "@angular/core";
import BackgroundGeolocation, {
    State,
    Location,
} from "cordova-background-geolocation-lt";

import { ResourcesService } from "./resources.service";
import { RunningContextService } from "./running-context.service";
import { SpatialService } from "./spatial.service";
import { LoggingService } from "./logging.service";
import { ILatLngTime } from "../models/models";

declare type GeoLocationServiceState = "disabled" | "searching" | "tracking";

@Injectable()
export class GeoLocationService {
    private static readonly TIME_OUT = 30000;
    private static readonly MAX_TIME_DIFFERENCE = 60; // seconds
    private static readonly MAX_SPPED = 55; // meters / seconds =~ 200 Km/hs
    private static readonly MIN_ACCURACY = 50; // meters

    private state: GeoLocationServiceState;
    private watchNumber: number;
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
        this.loggingService.info("Starting browser geo-location");
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
        BackgroundGeolocation.onLocation((location: Location) => {
            this.loggingService.info("Geo-location service got location: " + JSON.stringify(location))
            let position = {
                coords: {
                    accuracy: location.coords.accuracy,
                    altitude: location.coords.altitude,
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                    speed: location.coords.speed,
                    heading: location.coords.heading,
                    altitudeAccuracy: location.coords.altitude_accuracy
                },
                timestamp: new Date(location.timestamp).getTime()
            } as Position;
            this.handlePoistionChange(position);
        });

        BackgroundGeolocation.onEnabledChange((enabled) => this.loggingService.info("Geo-location service enabled changed: " + enabled));
        BackgroundGeolocation.ready({
            reset: true,
            desiredAccuracy: BackgroundGeolocation.DESIRED_ACCURACY_HIGH,
            allowIdenticalLocations: false,
            distanceFilter: 5,
            notification: {
                text: this.resources.runningInBackground,
                title: this.resources.israelHikingMap
            },
            debug: !this.runningContextService.isProduction,
            stopOnTerminate: true,
            foregroundService: true,
            logLevel: BackgroundGeolocation.LOG_LEVEL_VERBOSE,
        }, (state: State) => {
            this.wasInitialized = true;
            if (!state.enabled) {
                BackgroundGeolocation.start();
            }
        }, (error: string) => {
            this.loggingService.error("Location ready error: " + error);
        });
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
            this.loggingService.debug("Geo-location received position: " + JSON.stringify(this.positionToLatLngTime(position)));
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
