import { Injectable, EventEmitter, NgZone } from "@angular/core";
import { BackgroundGeolocationPlugin, Location } from "cordova-plugin-mauron85-background-geolocation";

import { ResourcesService } from "./resources.service";
import { RunningContextService } from "./running-context.service";
import { SpatialService } from "./spatial.service";
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
    private rejectedPosition: Position;
    public positionChanged: EventEmitter<Position>;
    public currentLocation: ILatLngTime;

    constructor(private readonly resources: ResourcesService,
        private readonly runningContextService: RunningContextService,
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
        if (window.navigator && window.navigator.geolocation) {
            if (this.watchNumber !== -1) {
                return;
            }
            this.watchNumber = window.navigator.geolocation.watchPosition(
                (position: Position): void => {
                    this.ngZone.run(() => {
                        this.state = "tracking";
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
            if (this.isBackground === false) {
                return;
            }
            this.ngZone.run(() => {
                this.state = "tracking";
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
            });

        BackgroundGeolocation.on("stop",
            () => {
                this.stopNavigator();
            });

        BackgroundGeolocation.on("background",
            () => {
                this.isBackground = true;
            });

        BackgroundGeolocation.on("foreground",
            () => {
                this.isBackground = false;
            });
    }

    private validRecordingAndUpdate(position: Position) {
        if (this.currentLocation == null) {
            this.updatePositionAndRaiseEvent(position);
            return;
        }
        let distance = SpatialService.getDistanceInMeters(this.currentLocation, this.positionToLatLngTime(position));
        let timeDifference = Math.abs(position.timestamp - this.currentLocation.timestamp.getTime()) / 1000;
        if (distance / timeDifference > GeoLocationService.MAX_SPPED || position.coords.accuracy > GeoLocationService.MIN_ACCURACY) {
            // speed is too high or accuracy circle is too big - must be an invalid point
            return;
        }
        if (timeDifference < GeoLocationService.MAX_TIME_DIFFERENCE) {
            this.updatePositionAndRaiseEvent(position);
            return;
        }
        if (this.rejectedPosition == null) {
            this.rejectedPosition = position;
            return;
        }
        let rejectedPositionTimeDifference = Math.abs(position.timestamp - this.rejectedPosition.timestamp) / 1000;
        if (rejectedPositionTimeDifference > GeoLocationService.MAX_TIME_DIFFERENCE) {
            this.rejectedPosition = position;
            return;
        }
        this.rejectedPosition = null;
        this.updatePositionAndRaiseEvent(position);
    }

    private updatePositionAndRaiseEvent(position: Position) {
        this.currentLocation = this.positionToLatLngTime(position);

        this.positionChanged.next(position);
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