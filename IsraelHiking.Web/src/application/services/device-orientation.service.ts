/// <reference types="cordova-plugin-device-orientation" />

import { Injectable, EventEmitter, NgZone } from "@angular/core";
import { App } from "@capacitor/app";
import { NgRedux } from "@angular-redux2/store";

import { LoggingService } from "./logging.service";
import { RunningContextService } from "./running-context.service";
import type { ApplicationState } from "../models/models";

@Injectable()
export class DeviceOrientationService {
    private static readonly THROTTLE_TIME = 500; // in milliseconds

    public orientationChanged: EventEmitter<number>;

    private watchId: number;

    constructor(private readonly ngZone: NgZone,
                private readonly loggingService: LoggingService,
                private readonly runningContextService: RunningContextService,
                private readonly ngRedux: NgRedux<ApplicationState>) {
        this.orientationChanged = new EventEmitter();
        this.watchId = -1;
    }

    public initialize() {
        if (!this.runningContextService.isCapacitor) {
            return;
        }
        App.addListener("appStateChange", (state) => {
            if (this.ngRedux.getState().gpsState.tracking === "disabled") {
                return;
            }
            if (state.isActive) {
                this.startListening();
            } else {
                this.stopListeining();
            }
        });
        if (this.ngRedux.getState().gpsState.tracking !== "disabled") {
            this.enable();
        }
    }

    private fireOrientationChange(heading: number) {
        this.ngZone.run(() => {
            if (heading < 0) {
                heading += 360;
            }
            if (this.getDeviceOrientation() === "landscape-primary") {
                heading += 90;
                if (heading > 360) {
                    heading -= 360;
                }
            } else if (this.getDeviceOrientation() === "landscape-secondary") {
                heading -= 90;
                if (heading < 0) {
                    heading += 360;
                }
            }
            this.orientationChanged.next(heading);
        });
    }

    private getDeviceOrientation(): OrientationType {
        if (window.screen.orientation) {
          return window.screen.orientation.type;
        }
      
        // iOS/safari
        switch (+window.orientation) {
            case 0: return "portrait-primary";
            case 90: return "landscape-primary";
            case 180: return "portrait-secondary";
            case -90: return "landscape-secondary";
            default: return "portrait-primary"
      }
    }

    public enable() {
        if (!this.runningContextService.isCapacitor) {
            return;
        }
        this.loggingService.info("[Orientation] Enabling device orientation service");
        this.startListening();
    }

    public disable() {
        if (!this.runningContextService.isCapacitor) {
            return;
        }
        this.loggingService.info("[Orientation] Disabling device orientation service");
        this.stopListeining();
    }

    private startListening() {
        if (this.watchId !== -1) {
            navigator.compass.clearWatch(this.watchId);
        }
        this.loggingService.info("[Orientation] Starting to listen to device orientation events");
        this.watchId = navigator.compass.watchHeading((d) => {
            this.fireOrientationChange(d.magneticHeading);
        }, () => {}, { frequency: DeviceOrientationService.THROTTLE_TIME});
    }

    private stopListeining() {
        this.loggingService.info("[Orientation] Stop listening to device orientation events");
        if (this.watchId !== -1) {
            navigator.compass.clearWatch(this.watchId);
            this.watchId = -1;
        }
    }
}
