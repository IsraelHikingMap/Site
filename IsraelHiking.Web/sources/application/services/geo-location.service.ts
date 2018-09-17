import { Injectable, EventEmitter, NgZone } from "@angular/core";
import * as L from "leaflet";

import { environment } from "../../environments/environment";
import { ResourcesService } from "./resources.service";
import * as Common from "../common/IsraelHiking";

declare type GeoLocationServiceState = "disabled" | "searching" | "tracking";

declare var BackgroundGeolocation: any;

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

    private state: GeoLocationServiceState;
    private watchNumber: number;
    private isBackground: boolean;

    public positionChanged: EventEmitter<Position>;
    public currentLocation: Common.ILatLngTime;

    constructor(private readonly resources: ResourcesService,
        private readonly ngZone: NgZone) {
        this.watchNumber = -1;
        this.positionChanged = new EventEmitter<Position>();
        this.state = "disabled";
        this.currentLocation = null;
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
        return this.state === "tracking" && environment.isCordova;
    }

    private startWatching() {
        this.state = "searching";
        if (environment.isCordova) {
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
                        this.currentLocation =
                            L.latLng(position.coords.latitude, position.coords.longitude, position.coords.altitude) as
                            Common.ILatLngTime;
                        this.currentLocation.timestamp = new Date(position.timestamp);
                        this.positionChanged.next(position);
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
        if (environment.isCordova) {
            BackgroundGeolocation.stop();
        } else {
            this.startNavigator();
        }
    }

    private stopNavigator() {
        if (this.watchNumber !== -1) {
            window.navigator.geolocation.clearWatch(this.watchNumber);
            this.watchNumber = -1;
        }
    }

    private configureBackgroundService() {
        if (!environment.isCordova) {
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
                this.currentLocation =
                    L.latLng(location.latitude, location.longitude, location.altitude) as Common.ILatLngTime;
                this.currentLocation.timestamp = new Date(location.time);
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
                this.positionChanged.next(position);
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
}