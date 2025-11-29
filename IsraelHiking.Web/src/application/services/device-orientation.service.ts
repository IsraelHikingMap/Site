import { Injectable, EventEmitter, NgZone, inject } from "@angular/core";
import { App } from "@capacitor/app";
import type { PluginListenerHandle } from "@capacitor/core";
import { CapgoCompass } from "@capgo/capacitor-compass";
import { Store } from "@ngxs/store";

import { LoggingService } from "./logging.service";
import { RunningContextService } from "./running-context.service";
import type { ApplicationState } from "../models";

@Injectable()
export class DeviceOrientationService {

    public orientationChanged = new EventEmitter<number>();

    private listenerHandle: PluginListenerHandle | null = null;

    private readonly ngZone = inject(NgZone);
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
                this.stopListening();
            }
        });
        if (this.store.selectSnapshot((s: ApplicationState) => s.gpsState).tracking !== "disabled") {
            this.enable();
        }
    }

    private fireOrientationChange(heading: number) {
        this.ngZone.run(() => {
            if (heading < 0) {
                heading += 360;
            }
            if (this.getDeviceOrientation() === "landscape-primary") {
                heading += 90;
                if (heading > 360) {
                    heading -= 360;
                }
            } else if (this.getDeviceOrientation() === "landscape-secondary") {
                heading -= 90;
                if (heading < 0) {
                    heading += 360;
                }
            }
            this.orientationChanged.next(heading);
        });
    }

    private getDeviceOrientation(): OrientationType {
        if (window.screen.orientation) {
          return window.screen.orientation.type;
        }

        // iOS/safari
        switch (+window.orientation) {
            case 0: return "portrait-primary";
            case 90: return "landscape-primary";
            case 180: return "portrait-secondary";
            case -90: return "landscape-secondary";
            default: return "portrait-primary";
      }
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
        this.stopListening();
    }

    private async startListening() {
        if (this.listenerHandle) {
            await this.listenerHandle.remove();
        }

        // Check and request compass permissions (required for iOS)
        const permissionStatus = await CapgoCompass.checkPermissions();
        if (permissionStatus.compass !== "granted") {
            this.loggingService.info("[Orientation] Requesting compass permissions");
            const requestResult = await CapgoCompass.requestPermissions();
            if (requestResult.compass !== "granted") {
                this.loggingService.info("[Orientation] Compass permission denied");
                return;
            }
        }

        this.loggingService.info("[Orientation] Starting to listen to device orientation events");
        this.listenerHandle = await CapgoCompass.addListener("headingChange", (event) => {
            this.fireOrientationChange(event.value);
        });
        await CapgoCompass.startListening();
    }

    private async stopListening() {
        this.loggingService.info("[Orientation] Stop listening to device orientation events");
        if (this.listenerHandle) {
            await CapgoCompass.stopListening();
            await this.listenerHandle.remove();
            this.listenerHandle = null;
        }
    }
}
