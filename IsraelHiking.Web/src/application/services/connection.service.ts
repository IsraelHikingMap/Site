import { EventEmitter, Injectable } from "@angular/core";
import { BehaviorSubject, firstValueFrom, interval } from "rxjs";
import { switchMap, tap, timeout } from "rxjs/operators";
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

    public stateChanged: EventEmitter<boolean>;
    private isOnline: boolean;
    private monitorInterval$ = new BehaviorSubject<number>(ConnectionService.HEART_BREAK_INTERVAL);

    constructor(private readonly http: HttpClient,
        private readonly loggingService: LoggingService) {
        this.stateChanged = new EventEmitter();
        this.isOnline = true;
        window.addEventListener("online", () => this.updateInternetAccessAndEmitIfNeeded())
        window.addEventListener("offline", () => this.updateInternetAccessAndEmitIfNeeded())
        this.InitializeDynamicTimer();
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

    private InitializeDynamicTimer() {
        this.monitorInterval$.pipe(
            switchMap(value => interval(value)),
            tap(() => this.updateInternetAccessAndEmitIfNeeded())
        ).subscribe();
    }

    private async updateInternetAccessAndEmitIfNeeded() {
        const previousState = this.isOnline;
        this.isOnline = await this.getInternetStatusNow();
        if (previousState !== this.isOnline) {
            this.loggingService.info("[Connection] Online state changed, online is: " + this.isOnline);
            this.stateChanged.next(this.isOnline);
            this.monitorInterval$.next(this.isOnline 
                ? ConnectionService.HEART_BREAK_INTERVAL
                : ConnectionService.HEART_BREAK_RETRY_INTERVAL);
            
        }
    }
}
