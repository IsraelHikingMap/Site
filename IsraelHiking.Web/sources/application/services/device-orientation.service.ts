import { Injectable, EventEmitter, NgZone } from "@angular/core";
import { fromEvent } from "rxjs";
import { throttleTime } from "rxjs/operators";

import { LoggingService } from "./logging.service";

@Injectable()
export class DeviceOrientationService {
    private static readonly THROTTLE_TIME = 100; // in milliseconds

    public orientationChanged: EventEmitter<number>;

    private initialOffset: number;
    private isBackground: boolean;

    constructor(private readonly ngZone: NgZone,
        private readonly loggingService: LoggingService) {
        this.orientationChanged = new EventEmitter();
        this.initialOffset = 0;
        this.isBackground = false;
    }

    public initialize() {
        if ("ondeviceorientationabsolute" in window) {
            this.loggingService.info("Initializing device orientation service with absolute event")
            fromEvent(window, "deviceorientationabsolute").pipe(
                throttleTime(DeviceOrientationService.THROTTLE_TIME, undefined, { trailing: true })
            ).subscribe((event: DeviceOrientationEvent) => {
                this.fireOrientationChange(event.alpha);
            });
        } else if ("ondeviceorientation" in window) {
            this.loggingService.info("Initializing device orientation service with regular event")
            fromEvent(window, "deviceorientation").pipe(
                throttleTime(DeviceOrientationService.THROTTLE_TIME, undefined, { trailing: true })
            ).subscribe((event: DeviceOrientationEvent & { webkitCompassAccuracy: number; webkitCompassHeading: number }) => {
                if (this.initialOffset === 0 && event.absolute !== true
                    && +event.webkitCompassAccuracy > 0 && +event.webkitCompassAccuracy < 50) {
                    this.initialOffset = event.webkitCompassHeading || 0;
                }
                this.fireOrientationChange(event.alpha - this.initialOffset);
            });
        }
        document.addEventListener("resume", () => {
            this.isBackground = false;
        });
        document.addEventListener("resign", () => {
            this.isBackground = true;
        });
        document.addEventListener("pause", () => {
            this.isBackground = true;
        });
    }

    private fireOrientationChange(alpha: number) {
        if (this.isBackground) {
            return;
        }
        this.ngZone.run(() => {
            if (alpha < 0) {
                alpha += 360;
            }
            if (window.screen.orientation.type === "landscape-secondary") {
                alpha += 90;
                if (alpha > 360) {
                    alpha -= 360;
                }
            } else if (window.screen.orientation.type === "landscape-primary") {
                alpha -= 90;
                if (alpha < 0) {
                    alpha += 360;
                }
            }
            alpha = 360 - alpha;
            this.orientationChanged.next(alpha);
        });
    }

}
