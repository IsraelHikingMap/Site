import { Injectable } from "@angular/core";
import { NgRedux } from "@angular-redux/store";
import { Idle, DEFAULT_INTERRUPTSOURCES } from "@ng-idle/core";

import { RunningContextService } from "./running-context.service";
import { ApplicationState } from "../models/models";

declare var cordova: any;

@Injectable()
export class ScreenService {

    constructor(private readonly runningContextService: RunningContextService,
                private readonly ngRedux: NgRedux<ApplicationState>,
                private readonly userIdleService: Idle) { }

    public initialize() {
        if (!this.runningContextService.isCordova) {
            return;
        }
        let brightness = cordova.plugins.brightness;
        brightness.setKeepScreenOn(true);
        document.addEventListener("resume", () => {
            brightness.setKeepScreenOn(true);
        }, false);
        if (this.runningContextService.isIos) {
            return;
        }
        document.addEventListener("resume", () => {
            brightness.setBrightness(-1);
            this.userIdleService.watch();
        }, false);
        document.addEventListener("pause", () => {
            this.userIdleService.stop();
        }, false);
        this.userIdleService.setInterrupts(DEFAULT_INTERRUPTSOURCES);
        this.userIdleService.setIdle(30);
        this.userIdleService.setTimeout(false);
        this.userIdleService.onIdleStart.subscribe(() => {
            if (this.ngRedux.getState().configuration.isBatteryOptimization) {
                brightness.setBrightness(0.01);
            }
        });
        this.userIdleService.onIdleEnd.subscribe(() => {
            if (this.ngRedux.getState().configuration.isBatteryOptimization) {
                brightness.setBrightness(-1);
            }
        });
        this.userIdleService.watch();
    }
}
