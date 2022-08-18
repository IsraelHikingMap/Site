import { Injectable, EventEmitter, NgZone } from "@angular/core";
import { Subscription } from "rxjs";
import { throttleTime } from "rxjs/operators";
import { App } from "@capacitor/app";
import { DeviceOrientation } from "@awesome-cordova-plugins/device-orientation/ngx";
import { NgRedux } from "@angular-redux2/store";

import { LoggingService } from "./logging.service";
import { RunningContextService } from "./running-context.service";
import type { ApplicationState } from "../models/models";

@Injectable()
export class DeviceOrientationService {
    private static readonly THROTTLE_TIME = 500; // in milliseconds

    public orientationChanged: EventEmitter<number>;

    private subscription: Subscription;

    constructor(private readonly ngZone: NgZone,
                private readonly loggingService: LoggingService,
                private readonly deviceOrientation: DeviceOrientation,
                private readonly runningContextService: RunningContextService,
                private readonly ngRedux: NgRedux<ApplicationState>) {
        this.orientationChanged = new EventEmitter();
        this.subscription = null;
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
            if (window.screen.orientation.type === "landscape-primary") {
                heading += 90;
                if (heading > 360) {
                    heading -= 360;
                }
            } else if (window.screen.orientation.type === "landscape-secondary") {
                heading -= 90;
                if (heading < 0) {
                    heading += 360;
                }
            }
            this.orientationChanged.next(heading);
        });
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
        if (this.subscription != null) {
            this.subscription.unsubscribe();
        }
        this.loggingService.info("[Orientation] Starting to listen to device orientation events");
        this.subscription = this.deviceOrientation.watchHeading().pipe(
            throttleTime(DeviceOrientationService.THROTTLE_TIME, undefined, { trailing: true })).subscribe(d => {
            this.fireOrientationChange(d.magneticHeading);
        });
    }

    private stopListeining() {
        this.loggingService.info("[Orientation] Stop listening to device orientation events");
        if (this.subscription != null) {
            this.subscription.unsubscribe();
            this.subscription = null;
        }
    }
}
