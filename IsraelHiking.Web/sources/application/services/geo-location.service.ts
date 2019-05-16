import { Injectable, EventEmitter, NgZone } from "@angular/core";
import { BackgroundGeolocationPlugin, Location } from "cordova-plugin-mauron85-background-geolocation";

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
        this.ngZone.run(() => {
            switch (this.state) {
                case "disabled":
                    return;
                case "searching":
                case "tracking":
                    this.stopWatching();
                    return;
            }
        });
    }

    public canRecord(): boolean {
        return this.state === "tracking" && this.currentLocation != null && this.runningContextService.isCordova;
    }

    private startWatching() {
        this.state = "searching";
        if (this.runningContextService.isCordova) {
            this.configureBackgroundService();
            BackgroundGeolocation.start();
        } else {
            this.startNavigator();
        }
    }

    private startNavigator() {
        this.loggingService.debug("Starting browser geo-location");
        if (window.navigator && window.navigator.geolocation) {
            if (this.watchNumber !== -1) {
                return;
            }
            this.watchNumber = window.navigator.geolocation.watchPosition(
                (position: Position): void => {
                    this.ngZone.run(() => {
                        this.loggingService.debug("geo-location received from browser location, bg: " + this.isBackground + " p: " + JSON.stringify(position));
                        if (this.state === "searching") {
                            this.state = "tracking";
                        }
                        if (this.state != "tracking") {
                            return;
                        }
                        this.validRecordingAndUpdate(position);
                    });
                },
                (err) => {
                    // sending error will terminate the stream
                    this.positionChanged.next(null);
                    this.disable();
                },
                {
                    enableHighAccuracy: true,
                    timeout: GeoLocationService.TIME_OUT
                });
        }
    }

    private stopWatching() {
        this.state = "disabled";
        this.currentLocation = null;
        if (this.runningContextService.isCordova) {
            BackgroundGeolocation.stop();
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

    private configureBackgroundService() {
        if (!this.runningContextService.isCordova) {
            return;
        }

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
            activitiesInterval: 10000
        });

        BackgroundGeolocation.on("location", (location: Location) => {
            this.loggingService.debug("geo-location received location, bg: " + this.isBackground + " l: " + JSON.stringify(location));
            if (this.isBackground === false) {
                return;
            }
            this.ngZone.run(() => {
                if (this.state === "searching") {
                    this.state = "tracking";
                }
                if (this.state != "tracking") {
                    return;
                }
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
                this.validRecordingAndUpdate(position);
            });
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
                this.startNavigator();
                this.loggingService.debug("Start geo-location service");
            });

        BackgroundGeolocation.on("stop",
            () => {
                this.stopNavigator();
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
    }

    private validRecordingAndUpdate(position: Position) {
        if (this.currentLocation == null) {
            this.updatePositionAndRaiseEvent(position);
            return;
        }
        if (this.isValid(this.currentLocation, position)) {
            this.updatePositionAndRaiseEvent(position);
            return;
        }
        if (this.rejectedPosition == null) {
            this.rejectedPosition = this.positionToLatLngTime(position);
            return;
        }
        if (this.isValid(this.rejectedPosition, position)) {
            this.updatePositionAndRaiseEvent(position);
            return;
        }
        this.rejectedPosition = this.positionToLatLngTime(position);
    }

    private isValid(test: ILatLngTime, position: Position): boolean {
        let distance = SpatialService.getDistanceInMeters(test, this.positionToLatLngTime(position));
        let timeDifference = Math.abs(position.timestamp - test.timestamp.getTime()) / 1000;
        if (timeDifference === 0) {
            return false;
        }
        if (distance / timeDifference > GeoLocationService.MAX_SPPED) {
            return false;
        }
        if (timeDifference > GeoLocationService.MAX_TIME_DIFFERENCE) {
            return false;
        }
        if (position.coords.accuracy > GeoLocationService.MIN_ACCURACY) {
            return false;
        }
        return true;
    }

    private updatePositionAndRaiseEvent(position: Position) {
        this.currentLocation = this.positionToLatLngTime(position);
        this.rejectedPosition = null;
        this.positionChanged.next(position);
        this.loggingService.debug("Valid position, updating: [" + position.coords.longitude + "," + position.coords.latitude + "]");
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