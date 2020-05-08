import { Injectable, EventEmitter, NgZone } from "@angular/core";
import {
    BackgroundGeolocation,
    BackgroundGeolocationEvents,
    BackgroundGeolocationResponse,
    BackgroundGeolocationLocationProvider,
    // BackgroundGeolocationAccuracy,
    BackgroundGeolocationLogLevel
} from "@ionic-native/background-geolocation/ngx";

import { ResourcesService } from "./resources.service";
import { RunningContextService } from "./running-context.service";
import { SpatialService } from "./spatial.service";
import { LoggingService } from "./logging.service";
import { ToastService } from "./toast.service";
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
    private isBackground: boolean;
    private rejectedPosition: ILatLngTime;
    private wasInitialized: boolean;

    public positionChanged: EventEmitter<Position>;
    public bulkPositionChanged: EventEmitter<Position[]>;
    public currentLocation: ILatLngTime;

    constructor(private readonly resources: ResourcesService,
                private readonly backgroundGeolocation: BackgroundGeolocation,
                private readonly runningContextService: RunningContextService,
                private readonly loggingService: LoggingService,
                private readonly toastService: ToastService,
                private readonly ngZone: NgZone) {
        this.watchNumber = -1;
        this.positionChanged = new EventEmitter<Position>();
        this.bulkPositionChanged = new EventEmitter<Position[]>();
        this.state = "disabled";
        this.isBackground = false;
        this.currentLocation = null;
        this.rejectedPosition = null;
        this.wasInitialized = false;
        this.isBackground = false;
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
                    this.loggingService.error("Failed to start tracking " + JSON.stringify(err));
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
            this.backgroundGeolocation.start();
            return;
        }
        this.wasInitialized = true;
        this.backgroundGeolocation.configure({
            locationProvider: BackgroundGeolocationLocationProvider.RAW_PROVIDER,
            desiredAccuracy: 0, // BackgroundGeolocationAccuracy.HIGH,
            stationaryRadius: 10,
            distanceFilter: 5,
            notificationTitle: this.resources.israelHikingMap,
            notificationText: this.resources.runningInBackground,
            interval: 1000,
            fastestInterval: 1000,
            activitiesInterval: 10000,
            startForeground: true
        });

        this.backgroundGeolocation.on(BackgroundGeolocationEvents.location).subscribe((location: BackgroundGeolocationResponse) => {
            let position = this.locationToPosition(location);
            this.handlePoistionChange(position);
        });

        this.backgroundGeolocation.on(BackgroundGeolocationEvents.start).subscribe(
            () => {
                this.loggingService.debug("Start geo-location service");
            });

        this.backgroundGeolocation.on(BackgroundGeolocationEvents.stop).subscribe(
            () => {
                this.loggingService.debug("Stop geo-location service");
            });

        this.backgroundGeolocation.on(BackgroundGeolocationEvents.background).subscribe(
            () => {
                this.isBackground = true;
                this.loggingService.debug("Geo-location now in background");
                this.backgroundGeolocation.deleteAllLocations();
            });

        this.backgroundGeolocation.on(BackgroundGeolocationEvents.foreground).subscribe(
            async () => {
                this.isBackground = false;
                this.loggingService.debug("Geo-location now in foreground");
                if (this.currentLocation) {
                    this.loggingService.debug("Sending bulk location update");
                    let locations = await this.backgroundGeolocation.getValidLocations();
                    let positions = locations.map(l => this.locationToPosition(l)).filter(p => this.validateRecordingAndUpdateState(p));
                    if (positions.length > 0) {
                        this.bulkPositionChanged.next(positions);
                    }
                }
            });
        this.backgroundGeolocation.start();
    }

    private stopWatching() {
        this.state = "disabled";
        this.currentLocation = null;
        this.positionChanged.next(null);
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
        this.backgroundGeolocation.stop();
    }

    private handlePoistionChange(position: Position): void {
        if (this.isBackground) {
            return;
        }
        this.ngZone.run(() => {
            this.loggingService.debug("Geo-location received position: " + JSON.stringify(this.positionToLatLngTime(position)));
            if (this.state === "searching") {
                this.state = "tracking";
            }
            if (this.state !== "tracking") {
                return;
            }
            if (this.validateRecordingAndUpdateState(position)) {
                this.positionChanged.next(position);
            }
        });
    }

    private validateRecordingAndUpdateState(position: Position): boolean {
        if (this.currentLocation == null) {
            this.loggingService.debug("Adding the first position: " + JSON.stringify(this.positionToLatLngTime(position)));
            this.updatePosition(position);
            return true;
        }
        let nonValidReason = this.isValid(this.currentLocation, position);
        if (nonValidReason === "") {
            this.updatePosition(position);
            return true;
        }
        if (this.rejectedPosition == null) {
            this.rejectedPosition = this.positionToLatLngTime(position);
            this.loggingService.debug("Rejecting position: " + JSON.stringify(this.positionToLatLngTime(position)) +
                " reason:" + nonValidReason);
            return false;
        }
        nonValidReason = this.isValid(this.rejectedPosition, position);
        if (nonValidReason === "") {
            this.loggingService.debug("Validating a rejected position: " + JSON.stringify(this.positionToLatLngTime(position)));
            this.updatePosition(position);
            return true;
        }
        this.rejectedPosition = this.positionToLatLngTime(position);
        this.loggingService.debug("Rejecting position for rejected: " + JSON.stringify(position) + " reason: " + nonValidReason);
        return false;
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

    private updatePosition(position: Position) {
        this.currentLocation = this.positionToLatLngTime(position);
        this.rejectedPosition = null;
        this.loggingService.debug("Valid position, updating: (" + position.coords.latitude + ", " + position.coords.longitude + ")");
    }

    public positionToLatLngTime(position: Position): ILatLngTime {
        return {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            alt: position.coords.altitude,
            timestamp: new Date(position.timestamp)
        };
    }

    private locationToPosition(location: BackgroundGeolocationResponse): Position {
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
        } as Position;
    }

    public async getLog(): Promise<string> {
        let logEntries = await this.backgroundGeolocation.getLogEntries(10000, 0, BackgroundGeolocationLogLevel.TRACE);
        return logEntries.map(logLine => {
            let dateString = new Date(logLine.timestamp - new Date().getTimezoneOffset() * 60 * 1000)
                .toISOString().replace(/T/, " ").replace(/\..+/, "");
            return dateString + " | " + logLine.level.padStart(5).toUpperCase() + " | " + logLine.message;
        }).join("\n");
    }
}
