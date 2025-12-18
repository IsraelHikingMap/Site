import { ApplicationRef, inject, Injectable } from "@angular/core";
import { BehaviorSubject, firstValueFrom } from "rxjs";
import { timeout } from "rxjs/operators";
import { HttpClient } from "@angular/common/http";

import { LoggingService } from "./logging.service";
import { Urls } from "../urls";

@Injectable()
export class ConnectionService {
    /**
     * Number of retries to check Internet connectivity before determining that there's no connection.
     */
    private static readonly NUMBER_OF_RETRIES = 3;
    /**
     * Timeout used to retry internet connectivity checks before determining that there's no connection.
     */
    private static readonly SINGLE_RETRY_TIMEOUT = 2000;
    /**
     * Interval used to retry internet connectivity checks when an error is detected (when no Internet connection).
     */
    private static readonly HEART_BREAK_RETRY_INTERVAL = 2 * ConnectionService.SINGLE_RETRY_TIMEOUT * ConnectionService.NUMBER_OF_RETRIES;
    /**
     * Interval used to check Internet connectivity specified in milliseconds.
     */
    private static readonly HEART_BREAK_INTERVAL = 30000;

    private readonly http = inject(HttpClient);
    private readonly loggingService = inject(LoggingService);
    private readonly appRef = inject(ApplicationRef);

    public stateChanged = new BehaviorSubject(true);

    private isOnline = true;
    private intervalId: ReturnType<typeof setInterval>;

    constructor() {
        if (typeof window === "undefined") {
            return;
        }
        window.addEventListener("online", () => this.updateInternetAccessAndEmitIfNeeded())
        window.addEventListener("offline", () => this.updateInternetAccessAndEmitIfNeeded())
        this.appRef.whenStable().then(() => {
            this.initializeDynamicTimer(ConnectionService.HEART_BREAK_INTERVAL);
            this.updateInternetAccessAndEmitIfNeeded();
        });
    }

    private async getInternetStatusNow(): Promise<boolean> {
        for (let retry = 0; retry < ConnectionService.NUMBER_OF_RETRIES; retry++) {
            try {
                await firstValueFrom(this.http.get(Urls.health, {
                    responseType: "text",
                    headers: {
                        ignoreProgressBar: ""
                    }
                }).pipe(timeout(ConnectionService.SINGLE_RETRY_TIMEOUT)));
                return true;
            } catch (ex) {
                const typeAndMessage = this.loggingService.getErrorTypeAndMessage(ex);
                if (typeAndMessage.type != "timeout") {
                    return false;
                }
            }
        }
        return false;
    }

    private initializeDynamicTimer(interval: number) {
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }
        this.intervalId = setInterval(() => this.updateInternetAccessAndEmitIfNeeded(), interval);
    }

    private async updateInternetAccessAndEmitIfNeeded() {
        const currentResponse = await this.getInternetStatusNow();
        if (currentResponse !== this.isOnline) {
            this.isOnline = currentResponse;
            this.loggingService.info("[Connection] Online state changed, online is: " + this.isOnline);
            this.stateChanged.next(this.isOnline);
            this.initializeDynamicTimer(this.isOnline
                ? ConnectionService.HEART_BREAK_INTERVAL
                : ConnectionService.HEART_BREAK_RETRY_INTERVAL);

        }
    }
}
