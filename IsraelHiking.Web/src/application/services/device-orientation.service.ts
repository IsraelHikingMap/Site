import { Injectable, EventEmitter, NgZone } from "@angular/core";
import { Subscription } from "rxjs";
import { throttleTime } from "rxjs/operators";
import { DeviceOrientation } from "@ionic-native/device-orientation/ngx";

import { LoggingService } from "./logging.service";

@Injectable()
export class DeviceOrientationService {
    private static readonly THROTTLE_TIME = 100; // in milliseconds

    public orientationChanged: EventEmitter<number>;

    private subscription: Subscription;
    private isBackground: boolean;

    constructor(private readonly ngZone: NgZone,
                private readonly loggingService: LoggingService,
                private readonly deviceOrientation: DeviceOrientation) {
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

    private fireOrientationChange(heading: number) {
        if (this.isBackground) {
            return;
        }
        this.ngZone.run(() => {
            if (heading < 0) {
                heading += 360;
            }
            if (window.screen.orientation.type === "landscape-primary") {
                heading += 90;
                if (heading > 360) {
                    heading -= 360;
                }
            } else if (window.screen.orientation.type === "landscape-secondary") {
                heading -= 90;
                if (heading < 0) {
                    heading += 360;
                }
            }
            this.orientationChanged.next(heading);
        });
    }

    public enable() {
        this.loggingService.info("[Orientation] Enabling device orientation service");
        this.subscription = this.deviceOrientation.watchHeading().pipe(
            throttleTime(DeviceOrientationService.THROTTLE_TIME, undefined, { trailing: true })).subscribe(d => {
            this.fireOrientationChange(d.magneticHeading);
        });
    }

    public disable() {
        if (this.subscription != null) {
            this.loggingService.info("[Orientation] Disabling device orientation service");
            this.subscription.unsubscribe();
        }
    }

}
