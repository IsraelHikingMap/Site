import { Injectable, EventEmitter, NgZone } from "@angular/core";
import { fromEvent } from "rxjs";
import { throttleTime } from "rxjs/operators";

@Injectable()
export class DeviceOrientationService {
    private static readonly THROTTLE_TIME = 100; // in milliseconds

    public orientationChanged: EventEmitter<number>;

    private initialOffset: number;

    constructor(private readonly ngZone: NgZone) {
        this.orientationChanged = new EventEmitter();
        this.initialOffset = 0;
        if ('ondeviceorientationabsolute' in window) {
            fromEvent(window, "deviceorientationabsolute").pipe(
                throttleTime(DeviceOrientationService.THROTTLE_TIME, undefined, { trailing: true })
            ).subscribe((event: DeviceOrientationEvent) => {
                this.fireOrientationChange(event.alpha);
            });
        } else if ('ondeviceorientation' in window) {
            fromEvent(window, "deviceorientation").pipe(
                throttleTime(DeviceOrientationService.THROTTLE_TIME, undefined, { trailing: true })
            ).subscribe((event: DeviceOrientationEvent & { webkitCompassAccuracy: number; webkitCompassHeading: number }) => {
                if (this.initialOffset === 0 && event.absolute !== true
                    && +event.webkitCompassAccuracy > 0 && +event.webkitCompassAccuracy < 50) {
                    this.initialOffset = event.webkitCompassHeading || 0;
                }
                this.fireOrientationChange(event.alpha - this.initialOffset)
            });
        }
    }

    private fireOrientationChange(alpha: number) {
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