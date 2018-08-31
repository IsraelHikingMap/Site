import { Injectable, EventEmitter } from "@angular/core";
import * as L from "leaflet";

import { environment } from "../../environments/environment";
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

    public positionChanged: EventEmitter<Position>;
    public currentLocation: Common.ILatLngTime;

    constructor() {
        this.watchNumber = -1;
        this.positionChanged = new EventEmitter<Position>();
        this.state = "disabled";
        this.currentLocation = null;
        this.configureBackgroundService();
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
        return this.state === "tracking" && environment.isCordova;
    }

    private startWatching() {
        if (environment.isCordova) {
            this.state = "searching";
            BackgroundGeolocation.checkStatus(status => {
                console.log("[INFO] BackgroundGeolocation service is running", status.isRunning);
                console.log("[INFO] BackgroundGeolocation services enabled", status.locationServicesEnabled);
                console.log("[INFO] BackgroundGeolocation auth status: " + status.authorization);

                // you don't need to check status before start (this is just the example)
                if (!status.isRunning) {
                    BackgroundGeolocation.start(); // triggers start on start event
                }
            });
            return;
        }
        if (window.navigator && window.navigator.geolocation) {
            this.state = "searching";
            this.watchNumber = window.navigator.geolocation.watchPosition(
                (position: Position): void => {
                    this.state = "tracking";
                    this.currentLocation =
                        L.latLng(position.coords.latitude, position.coords.longitude, position.coords.altitude) as Common.ILatLngTime;
                    this.currentLocation.timestamp = new Date(position.timestamp);
                    this.positionChanged.next(position);
                },
                (err) => {
                    // sending error will terminate the stream
                    console.log(err);
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
            console.log("[DEBUG] stop watching");
            BackgroundGeolocation.stop();
        }
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
            notificationTitle: "פועל ברקע",
            notificationText: "מקליט מסלול",
            debug: false,
            interval: 1000,
            fastestInterval: 1000,
            activitiesInterval: 10000
        });

        BackgroundGeolocation.on("location", location => {
            console.log("[INFO] On location", location);
            this.state = "tracking";
            this.currentLocation = L.latLng(location.latitude, location.longitude, location.altitude) as Common.ILatLngTime;
            this.currentLocation.timestamp = new Date();
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

        BackgroundGeolocation.on("error", error => {
            console.log("[ERROR] BackgroundGeolocation error:", error.code, error.message);
        });

        BackgroundGeolocation.on("start", () => {
            console.log("[INFO] BackgroundGeolocation service has been started");
        });

        BackgroundGeolocation.on("stop", () => {
            console.log("[INFO] BackgroundGeolocation service has been stopped");
        });

        BackgroundGeolocation.on("authorization", status => {
            console.log("[INFO] BackgroundGeolocation authorization status: " + status);
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

        BackgroundGeolocation.on("background", () => {
            console.log("[INFO] App is in background");
        });

        BackgroundGeolocation.on("foreground", () => {
            console.log("[INFO] App is in foreground");
        });
    }
}