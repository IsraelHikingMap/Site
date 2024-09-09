import { inject, Injectable } from "@angular/core";
import { BehaviorSubject, firstValueFrom } from "rxjs";
import { timeout } from "rxjs/operators";
import { HttpClient } from "@angular/common/http";

import { LoggingService } from "./logging.service";
import { Urls } from "../urls";

@Injectable()
export class ConnectionService {
    /**
     * Interval used to retry Internet connectivity checks when an error is detected (when no Internet connection). Default value is "1000".
     */
    private static readonly HEART_BREAK_RETRY_INTERVAL = 1000;
    /**
     * Interval used to check Internet connectivity specified in milliseconds. Default value is "30000".
     */
    private static readonly HEART_BREAK_INTERVAL = 30000;

    private readonly http = inject(HttpClient);
    private readonly loggingService = inject(LoggingService);

    public stateChanged = new BehaviorSubject(true);

    private isOnline = true;
    private intervalId: ReturnType<typeof setInterval>;

    constructor() {
        window.addEventListener("online", () => this.updateInternetAccessAndEmitIfNeeded())
        window.addEventListener("offline", () => this.updateInternetAccessAndEmitIfNeeded())
        this.initializeDynamicTimer(ConnectionService.HEART_BREAK_INTERVAL);
        this.updateInternetAccessAndEmitIfNeeded();
    }

    private async getInternetStatusNow(): Promise<boolean> {
        try {
            await firstValueFrom(this.http.get(Urls.health, {
                responseType: "text",
                headers: {
                    ignoreProgressBar: ""
                }
            }).pipe(timeout(500)));
            return true;
        } catch {
            return false;
        }
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
