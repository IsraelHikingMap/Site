import { Injectable } from "@angular/core";
import { NgRedux } from "@angular-redux/store";
import { Idle, DEFAULT_INTERRUPTSOURCES } from "@ng-idle/core";
import { Brightness } from "@ionic-native/brightness/ngx";
import { MobileAccessibility } from "@ionic-native/mobile-accessibility/ngx";
import { StatusBar } from "@ionic-native/status-bar/ngx";

import { RunningContextService } from "./running-context.service";
import { ApplicationState } from "../models/models";
import { LoggingService } from "./logging.service";

@Injectable()
export class ScreenService {

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
        this.brightness.setKeepScreenOn(true);
        this.originalBrightness = await this.brightness.getBrightness();
        document.addEventListener("resume", () => {
            this.logger.debug(`Resume app, setting brightness to original: ${this.originalBrightness}`);
            this.brightness.setKeepScreenOn(true);
            this.brightness.setBrightness(this.originalBrightness);
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
                this.brightness.setBrightness(0.01);
            }
        });
        this.userIdleService.onIdleEnd.subscribe(() => {
            if (this.ngRedux.getState().configuration.isBatteryOptimization) {
                this.logger.debug(`User is active, setting brightness to original: ${this.originalBrightness}`);
                this.brightness.setBrightness(this.originalBrightness);
            }
        });
        this.userIdleService.watch();
    }
}
