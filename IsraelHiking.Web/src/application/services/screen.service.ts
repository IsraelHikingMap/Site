import { Injectable } from "@angular/core";
import { Idle, DEFAULT_INTERRUPTSOURCES } from "@ng-idle/core";
import { KeepAwake } from "@capacitor-community/keep-awake";
import { ScreenBrightness } from "@capacitor-community/screen-brightness";
import { MobileAccessibility } from "@ionic-native/mobile-accessibility/ngx";
import { StatusBar } from "@ionic-native/status-bar/ngx";
import { Observable } from "rxjs";
import { NgRedux, select } from "@angular-redux2/store";

import { RunningContextService } from "./running-context.service";
import { LoggingService } from "./logging.service";
import type { ApplicationState, BatteryOptimizationType } from "../models/models";

@Injectable()
export class ScreenService {

    @select((state: ApplicationState) => state.configuration.batteryOptimizationType)
    public batteryOptimizationType$: Observable<BatteryOptimizationType>;

    private originalBrightness: number;

    constructor(private readonly runningContextService: RunningContextService,
                private readonly mobileAccesibility: MobileAccessibility,
                private readonly statusBar: StatusBar,
                private readonly ngRedux: NgRedux<ApplicationState>,
                private readonly userIdleService: Idle,
                private readonly logger: LoggingService) { }

    public async initialize() {
        if (!this.runningContextService.isCapacitor) {
            return;
        }
        // HM TODO: bring this back if needed
        //if (this.runningContextService.isIos) {
        //    this.statusBar.overlaysWebView(true);
        //    this.statusBar.overlaysWebView(false);
        //}
        //this.mobileAccesibility.usePreferredTextZoom(false);
        this.setKeepScreenOn();
        this.originalBrightness = (await ScreenBrightness.getBrightness()).brightness;
        this.logger.info(`[Screen] Original brightness is: ${this.originalBrightness}`);
        document.addEventListener("resume", () => {
            this.logger.info(`[Screen] Resume app, setting brightness to original: ${this.originalBrightness}`);
            this.setKeepScreenOn();
            ScreenBrightness.setBrightness({ brightness: this.originalBrightness}); // this is just to be on the safe side...
            this.userIdleService.watch();
        }, false);
        document.addEventListener("resign", () => {
            this.logger.info(`[Screen] Resigning app, setting brightness to original: ${this.originalBrightness}`);
            ScreenBrightness.setBrightness({ brightness: this.originalBrightness}); // this is just to be on the safe side...
        }, false);
        document.addEventListener("pause", () => {
            this.userIdleService.stop();
            this.logger.info("[Screen] Pausing app, stopping user idle service");
        }, false);
        this.userIdleService.setInterrupts(DEFAULT_INTERRUPTSOURCES);
        this.userIdleService.setIdle(30);
        this.userIdleService.setTimeout(false);
        this.userIdleService.onIdleStart.subscribe(() => {
            if (this.ngRedux.getState().configuration.batteryOptimizationType === "dark") {
                this.logger.info("[Screen] User is idle, setting brightness to 0.01");
                ScreenBrightness.setBrightness({ brightness: 0.01});
            }
        });
        this.userIdleService.onIdleEnd.subscribe(() => {
            if (this.ngRedux.getState().configuration.batteryOptimizationType === "dark") {
                this.logger.info(`[Screen] User is active, setting brightness to original: ${this.originalBrightness}`);
                ScreenBrightness.setBrightness({ brightness: this.originalBrightness}); // this is just to be on the safe side...
            }
        });
        this.userIdleService.watch();

        this.batteryOptimizationType$.subscribe(() => this.setKeepScreenOn());
    }

    private setKeepScreenOn() {
        this.logger.info(`[Screen] Setting mode: ${this.ngRedux.getState().configuration.batteryOptimizationType}`);
        if (this.ngRedux.getState().configuration.batteryOptimizationType !== "screen-off") {
            KeepAwake.keepAwake();
        } else {
            KeepAwake.allowSleep();
        }
    }
}
