import { Injectable, EventEmitter, NgZone } from "@angular/core";
import { fromEvent, Subscription } from "rxjs";
import { throttleTime } from "rxjs/operators";

import { LoggingService } from "./logging.service";
import { RunningContextService } from "./running-context.service";

@Injectable()
export class DeviceOrientationService {
    private static readonly THROTTLE_TIME = 100; // in milliseconds

    public orientationChanged: EventEmitter<number>;

    private subscription: Subscription;
    private isBackground: boolean;

    constructor(private readonly ngZone: NgZone,
                private readonly runningContextService: RunningContextService,
                private readonly loggingService: LoggingService) {
        this.orientationChanged = new EventEmitter();
        this.isBackground = false;
        this.subscription = null;
    }

    public initialize() {
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

    public enable() {
        if (this.runningContextService.isIos) {
            (DeviceOrientationEvent as any).requestPermission();
        }
        if ("ondeviceorientationabsolute" in window) {
            this.loggingService.info("Enabling device orientation service with absolute event");
            this.subscription = fromEvent(window, "deviceorientationabsolute").pipe(
                throttleTime(DeviceOrientationService.THROTTLE_TIME, undefined, { trailing: true })
            ).subscribe((event: DeviceOrientationEvent) => {
                this.fireOrientationChange(event.alpha);
            });
        } else if ("ondeviceorientation" in window) {
            this.loggingService.info("Enabling device orientation service with regular event");
            this.subscription = fromEvent(window, "deviceorientation").pipe(
                throttleTime(DeviceOrientationService.THROTTLE_TIME, undefined, { trailing: true })
            ).subscribe((event: DeviceOrientationEvent & { webkitCompassAccuracy: number; webkitCompassHeading: number }) => {
                let alpha = event.alpha;
                if (event.absolute !== true && +event.webkitCompassAccuracy > 0 && +event.webkitCompassAccuracy < 50) {
                    alpha = 360 - event.webkitCompassHeading;
                }
                this.fireOrientationChange(alpha);
            });
        }
    }

    public disable() {
        if (this.subscription != null) {
            this.loggingService.info("Disabling device orientation service");
            this.subscription.unsubscribe();
        }
    }

}
