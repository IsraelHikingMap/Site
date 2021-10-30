import { Injectable } from "@angular/core";
import { Idle, DEFAULT_INTERRUPTSOURCES } from "@ng-idle/core";
import { Brightness } from "@ionic-native/brightness/ngx";
import { MobileAccessibility } from "@ionic-native/mobile-accessibility/ngx";
import { StatusBar } from "@ionic-native/status-bar/ngx";
import { Observable } from "rxjs";

import { RunningContextService } from "./running-context.service";
import { LoggingService } from "./logging.service";
import { NgRedux, select } from "../reducers/infra/ng-redux.module";
import type { ApplicationState, BatteryOptimizationType } from "../models/models";

@Injectable()
export class ScreenService {

    @select((state: ApplicationState) => state.configuration.batteryOptimizationType)
    public batteryOptimizationType$: Observable<BatteryOptimizationType>;

    private originalBrightness: number;

    constructor(private readonly runningContextService: RunningContextService,
                private readonly brightness: Brightness,
                private readonly mobileAccesibility: MobileAccessibility,
                private readonly statusBar: StatusBar,
                private readonly ngRedux: NgRedux<ApplicationState>,
                private readonly userIdleService: Idle,
                private readonly logger: LoggingService) { }

    public async initialize() {
        if (!this.runningContextService.isCordova) {
            return;
        }
        if (this.runningContextService.isIos) {
            this.statusBar.overlaysWebView(true);
            this.statusBar.overlaysWebView(false);
        }
        this.mobileAccesibility.usePreferredTextZoom(false);
        this.setKeepScreenOn();
        this.originalBrightness = await this.brightness.getBrightness();
        this.logger.info(`[Screen] Original brightness is: ${this.originalBrightness}`);
        document.addEventListener("resume", () => {
            this.logger.info(`[Screen] Resume app, setting brightness to original: ${this.originalBrightness}`);
            this.setKeepScreenOn();    
            this.brightness.setBrightness(this.originalBrightness); // this is just to be on the safe side...
            this.userIdleService.watch();
        }, false);
        document.addEventListener("resign", () => {
            this.logger.info(`[Screen] Resigning app, setting brightness to original: ${this.originalBrightness}`);
            this.brightness.setBrightness(this.originalBrightness); // this is just to be on the safe side...
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
                this.brightness.setBrightness(0.01);
            }
        });
        this.userIdleService.onIdleEnd.subscribe(() => {
            if (this.ngRedux.getState().configuration.batteryOptimizationType === "dark") {
                this.logger.info(`[Screen] User is active, setting brightness to original: ${this.originalBrightness}`);
                this.brightness.setBrightness(this.originalBrightness);
            }
        });
        this.userIdleService.watch();

        this.batteryOptimizationType$.subscribe(() => this.setKeepScreenOn());
    }

    private setKeepScreenOn() {
        this.logger.info(`[Screen] Setting mode: ${this.ngRedux.getState().configuration.batteryOptimizationType}`);
        this.brightness.setKeepScreenOn(this.ngRedux.getState().configuration.batteryOptimizationType !== "screen-off");
    }
}
