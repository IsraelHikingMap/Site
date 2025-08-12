import { inject, Injectable } from "@angular/core";
import { Idle, DEFAULT_INTERRUPTSOURCES } from "@ng-idle/core";
import { TextZoom } from "@capacitor/text-zoom";
import { KeepAwake } from "@capacitor-community/keep-awake";
import { ScreenBrightness } from "@capacitor-community/screen-brightness";
import { App } from "@capacitor/app";
import { Store } from "@ngxs/store";

import { RunningContextService } from "./running-context.service";
import { LoggingService } from "./logging.service";
import { ToggleAddRecordingPoiAction } from "../reducers/recorded-route.reducer";
import type { ApplicationState } from "../models";

@Injectable()
export class ScreenService {
    private originalBrightness: number;

    private readonly runningContextService = inject(RunningContextService);
    private readonly store = inject(Store);
    private readonly userIdleService = inject(Idle);
    private readonly logger = inject(LoggingService);

    public async initialize() {
        if (!this.runningContextService.isCapacitor) {
            return;
        }

        TextZoom.set({ value: 1.0 });
        this.setKeepScreenOn();
        this.originalBrightness = (await ScreenBrightness.getBrightness()).brightness;
        this.logger.info(`[Screen] Original brightness is: ${this.originalBrightness}`);
        App.addListener("appStateChange", (state) => {
            ScreenBrightness.setBrightness({ brightness: this.originalBrightness}); // this is just to be on the safe side...
            if (state.isActive) {
                this.logger.info("[Screen] App is active, watching idle and setting screen mode");
                this.setKeepScreenOn();
                this.userIdleService.watch();
            } else {
                this.logger.info(`[Screen] App is inactive, stop watching idle setting brightness to original: ${this.originalBrightness}`);
                this.userIdleService.stop();
                if (this.store.selectSnapshot((s: ApplicationState) => s.recordedRouteState).isAddingPoi) {
                    this.store.dispatch(new ToggleAddRecordingPoiAction());
                }
            }
        });
        this.userIdleService.setInterrupts(DEFAULT_INTERRUPTSOURCES);
        this.userIdleService.setIdle(30);
        this.userIdleService.setTimeout(false);
        this.userIdleService.onIdleStart.subscribe(() => {
            if (this.store.selectSnapshot((s: ApplicationState) => s.recordedRouteState).isAddingPoi) {
                this.store.dispatch(new ToggleAddRecordingPoiAction());
            }
            if (this.store.selectSnapshot((s: ApplicationState) => s.configuration).batteryOptimizationType === "dark") {
                this.logger.info("[Screen] User is idle, setting brightness to 0.01");
                ScreenBrightness.setBrightness({ brightness: 0.01});
            }
        });
        this.userIdleService.onIdleEnd.subscribe(() => {
            if (this.store.selectSnapshot((s: ApplicationState) => s.configuration).batteryOptimizationType === "dark") {
                this.logger.info(`[Screen] User is active, setting brightness to original: ${this.originalBrightness}`);
                ScreenBrightness.setBrightness({ brightness: this.originalBrightness}); // this is just to be on the safe side...
            }
        });
        this.userIdleService.watch();

        this.store.select((state: ApplicationState) => state.configuration.batteryOptimizationType).subscribe(() => this.setKeepScreenOn());
    }

    private setKeepScreenOn() {
        const configuration = this.store.selectSnapshot((s: ApplicationState) => s.configuration);
        this.logger.info(`[Screen] Setting mode: ${configuration.batteryOptimizationType}`);
        if (configuration.batteryOptimizationType !== "screen-off") {
            KeepAwake.keepAwake();
        } else {
            KeepAwake.allowSleep();
        }
    }
}
