import { Injectable, EventEmitter, NgZone } from "@angular/core";
import { BackgroundGeolocationPlugin } from "cordova-plugin-mauron85-background-geolocation";

import { ResourcesService } from "./resources.service";
import { ILatLngTime } from "../models/models";
import { RunningContextService } from "./running-context.service";

declare type GeoLocationServiceState = "disabled" | "searching" | "tracking";

declare var BackgroundGeolocation: BackgroundGeolocationPlugin;

interface IBackgroundLocation {
    accuracy: number;
    altitude: number;
    bearing: number;
    latitude: number;
    locationProvider: number;
    longitude: number;
    provider: string;
    speed: number;
    time: number;
}

@Injectable()
export class GeoLocationService {
    private static readonly TIME_OUT = 30000;
    private static readonly MAX_TIME_DIFFERENCE = 60 * 1000;

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
        return this.state === "tracking" && this.currentLocation != null; // && this.runningContextService.isCordova;
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

        BackgroundGeolocation.on("location", (location: IBackgroundLocation) => {
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
        let timeDifference = Math.abs(position.timestamp - this.currentLocation.timestamp.getTime());
        if (timeDifference < GeoLocationService.MAX_TIME_DIFFERENCE) {
            this.updatePositionAndRaiseEvent(position);
            return;
        }
        if (this.rejectedPosition == null) {
            this.rejectedPosition = position;
            return;
        }
        let rejectedPositionTimeDifference = Math.abs(position.timestamp - this.rejectedPosition.timestamp);
        if (rejectedPositionTimeDifference > GeoLocationService.MAX_TIME_DIFFERENCE) {
            this.rejectedPosition = position;
            return;
        }
        this.rejectedPosition = null;
        this.updatePositionAndRaiseEvent(position);
    }

    private updatePositionAndRaiseEvent(position: Position) {
        this.currentLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            alt: position.coords.altitude,
            timestamp: new Date(position.timestamp)
        } as ILatLngTime;

        this.positionChanged.next(position);
    }
}