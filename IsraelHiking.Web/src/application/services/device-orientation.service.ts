import { EventEmitter, inject, Service } from "@angular/core";
import { App } from "@capacitor/app";
import { Store } from "@ngxs/store";
import { CapgoCompass } from "@capgo/capacitor-compass";

import { LoggingService } from "./logging.service";
import { RunningContextService } from "./running-context.service";
import type { ApplicationState } from "../models";

/**
 * How much of each new compass reading is taken into the heading. The raw readings jitter by a few degrees between
 * events, which shakes the map when it turns to every one of them, so they are averaged out over the last few events.
 */
const HEADING_SMOOTHING_FACTOR = 0.25;

/**
 * Moves the previous heading part of the way towards the new reading, going around the shorter side of the circle so
 * that readings on both sides of north average to north and not to south.
 */
export function smoothHeading(previous: number | null, heading: number): number {
    if (previous == null) {
        return heading;
    }
    const delta = ((heading - previous + 540) % 360) - 180;
    return (previous + HEADING_SMOOTHING_FACTOR * delta + 360) % 360;
}

@Service()
export class DeviceOrientationService {
    public readonly orientationChanged = new EventEmitter<number>();

    private eventHandler: { remove: () => Promise<void> } = null;
    private heading: number | null = null;

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
        this.heading = null;
        this.eventHandler = await CapgoCompass.addListener("headingChange", (event) => {
            this.heading = smoothHeading(this.heading, event.value);
            this.orientationChanged.next(this.heading);
        });
        await CapgoCompass.startListening({ minInterval: 100 });
        this.loggingService.info("[Orientation] Started listening to device orientation events");
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
