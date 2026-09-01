import { computed, effect, inject, Injector, Service } from "@angular/core";
import { TextZoom } from "@capacitor/text-zoom";
import { KeepAwake } from "@capacitor-community/keep-awake";
import { ScreenBrightness } from "@capacitor-community/screen-brightness";
import { App } from "@capacitor/app";
import { Store } from "@ngxs/store";

import { RunningContextService } from "./running-context.service";
import { LoggingService } from "./logging.service";
import { IdleService } from "./idle.service";
import { OfflineFilesDownloadService } from "./offline-files-download.service";
import { ToggleAddRecordingPoiAction } from "../reducers/recorded-route.reducer";
import type { ApplicationState } from "../models";

@Service()
export class ScreenService {
    private originalBrightness: number;

    private readonly runningContextService = inject(RunningContextService);
    private readonly store = inject(Store);
    private readonly userIdleService = inject(IdleService);
    private readonly logger = inject(LoggingService);
    private readonly offlineFilesDownloadService = inject(OfflineFilesDownloadService);
    private readonly injector = inject(Injector);

    /**
     * Whether offline files are being downloaded right now. The download only goes on while the app is
     * awake, so a screen that goes off in the middle of one stops it, which is why it holds the screen on
     * for as long as it takes no matter what the battery optimization is set to.
     * It is a boolean of its own rather than the download itself, so that it only reacts to a download
     * starting and ending and not to every step it makes.
     */
    private readonly isDownloadingOfflineFiles = computed(() => this.offlineFilesDownloadService.currentDownloadedTile() != null);

    public async initialize() {
        if (!this.runningContextService.isCapacitor) {
            return;
        }

        TextZoom.set({ value: 1.0 });
        this.setKeepScreenOn();
        this.originalBrightness = (await ScreenBrightness.getBrightness()).brightness;
        this.logger.info(`[Screen] Original brightness is: ${this.originalBrightness}`);
        App.addListener("appStateChange", (state) => {
            ScreenBrightness.setBrightness({ brightness: this.originalBrightness }); // this is just to be on the safe side...
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
        this.userIdleService.onIdleStart.subscribe(() => {
            if (this.store.selectSnapshot((s: ApplicationState) => s.recordedRouteState).isAddingPoi) {
                this.store.dispatch(new ToggleAddRecordingPoiAction());
            }
            if (this.store.selectSnapshot((s: ApplicationState) => s.configuration).batteryOptimizationType === "dark") {
                this.logger.info("[Screen] User is idle, setting brightness to 0.01");
                ScreenBrightness.setBrightness({ brightness: 0.01 });
            }
        });
        this.userIdleService.onIdleEnd.subscribe(() => {
            if (this.store.selectSnapshot((s: ApplicationState) => s.configuration).batteryOptimizationType === "dark") {
                this.logger.info(`[Screen] User is active, setting brightness to original: ${this.originalBrightness}`);
                ScreenBrightness.setBrightness({ brightness: this.originalBrightness }); // this is just to be on the safe side...
            }
        });
        this.userIdleService.watch();

        this.store.select((state: ApplicationState) => state.configuration.batteryOptimizationType).subscribe(() => this.setKeepScreenOn());
        effect(() => this.setKeepScreenOn(), { injector: this.injector });
    }

    /**
     * Sets whether the screen is allowed to go off, which it is only when the user asked for it and there
     * is nothing going on that the screen going off would stop, see isDownloadingOfflineFiles.
     */
    private setKeepScreenOn() {
        const configuration = this.store.selectSnapshot((s: ApplicationState) => s.configuration);
        const isDownloading = this.isDownloadingOfflineFiles();
        this.logger.info(`[Screen] Battery optimization type: ${configuration.batteryOptimizationType}` +
            `${isDownloading ? ", keeping the screen on while offline files are downloaded" : ""}`);
        if (isDownloading || configuration.batteryOptimizationType !== "screen-off") {
            KeepAwake.keepAwake();
        } else {
            KeepAwake.allowSleep();
        }
    }
}
