import { Injectable, EventEmitter, inject } from "@angular/core";
import { App } from "@capacitor/app";
import { Store } from "@ngxs/store";
import { CapgoCompass } from "@capgo/capacitor-compass";

import { LoggingService } from "./logging.service";
import { RunningContextService } from "./running-context.service";
import type { ApplicationState } from "../models";

@Injectable()
export class DeviceOrientationService {
    public orientationChanged = new EventEmitter<number>();

    private eventHandler: { remove: () => Promise<void> } = null;

    private readonly loggingService = inject(LoggingService);
    private readonly runningContextService = inject(RunningContextService);
    private readonly store = inject(Store);

    public initialize() {
        if (!this.runningContextService.isCapacitor) {
            return;
        }
        App.addListener("appStateChange", (state) => {
            if (this.store.selectSnapshot((s: ApplicationState) => s.gpsState).tracking === "disabled") {
                return;
            }
            if (state.isActive) {
                this.startListening();
            } else {
                this.stopListeining();
            }
        });
        if (this.store.selectSnapshot((s: ApplicationState) => s.gpsState).tracking !== "disabled") {
            this.enable();
        }
    }

    public enable() {
        if (!this.runningContextService.isCapacitor) {
            return;
        }
        this.loggingService.info("[Orientation] Enabling device orientation service");
        this.startListening();
    }

    public async disable() {
        if (!this.runningContextService.isCapacitor) {
            return;
        }
        this.loggingService.info("[Orientation] Disabling device orientation service");
        await this.stopListeining();
    }

    private async startListening() {
        if (this.eventHandler) {
            this.eventHandler.remove();
            this.eventHandler = null;
        }
        this.loggingService.info("[Orientation] Starting to listen to device orientation events");
        this.eventHandler = await CapgoCompass.addListener("headingChange", (event) => {
            this.orientationChanged.next(event.value);
        });
        await CapgoCompass.startListening();
        this.loggingService.info("[Orientation] Starting to listen to device orientation events");
    }

    private async stopListeining() {
        if (!this.eventHandler) {
            return;
        }
        this.loggingService.info("[Orientation] Stop listening to device orientation events");
        await this.eventHandler.remove();
        this.eventHandler = null;
        await CapgoCompass.stopListening();
    }
}
