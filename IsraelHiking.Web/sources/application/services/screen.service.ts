import { Injectable } from "@angular/core";
import { NgRedux } from "@angular-redux/store";
import { Idle, DEFAULT_INTERRUPTSOURCES } from "@ng-idle/core";

import { RunningContextService } from "./running-context.service";
import { ApplicationState } from "../models/models";
import { LoggingService } from "./logging.service";

declare var cordova: any;
declare var StatusBar: any;
declare var MobileAccessibility: any;

@Injectable()
export class ScreenService {

    private originalBrightness: number;

    constructor(private readonly runningContextService: RunningContextService,
                private readonly ngRedux: NgRedux<ApplicationState>,
                private readonly userIdleService: Idle,
                private readonly logger: LoggingService) { }

    public initialize() {
        if (!this.runningContextService.isCordova) {
            return;
        }
        if (this.runningContextService.isIos) {
            StatusBar.overlaysWebView(true);
            StatusBar.overlaysWebView(false);
        }
        MobileAccessibility.usePreferredTextZoom(false);
        let brightness = cordova.plugins.brightness;
        brightness.setKeepScreenOn(true);
        brightness.getBrightness((currentBrightness) => this.originalBrightness = currentBrightness);
        document.addEventListener("resume", () => {
            brightness.setKeepScreenOn(true);
        }, false);
        document.addEventListener("resume", () => {
            this.logger.debug(`Resume app, setting brightness to original: ${this.originalBrightness}`);
            brightness.setBrightness(this.originalBrightness);
            this.userIdleService.watch();
        }, false);
        document.addEventListener("pause", () => {
            this.logger.debug("Pausing app, stopping user idle service.");
            this.userIdleService.stop();
        }, false);
        this.userIdleService.setInterrupts(DEFAULT_INTERRUPTSOURCES);
        this.userIdleService.setIdle(30);
        this.userIdleService.setTimeout(false);
        this.userIdleService.onIdleStart.subscribe(() => {
            if (this.ngRedux.getState().configuration.isBatteryOptimization) {
                this.logger.debug("User is idle, setting brightness to 0.01");
                brightness.setBrightness(0.01);
            }
        });
        this.userIdleService.onIdleEnd.subscribe(() => {
            if (this.ngRedux.getState().configuration.isBatteryOptimization) {
                this.logger.debug(`User is active, setting brightness to original: ${this.originalBrightness}`);
                brightness.setBrightness(this.originalBrightness);
            }
        });
        this.userIdleService.watch();
    }
}
