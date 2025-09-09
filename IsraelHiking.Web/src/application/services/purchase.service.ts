import { inject, Injectable } from "@angular/core";
import { Store } from "@ngxs/store";
import { LOG_LEVEL, Purchases } from "@revenuecat/purchases-capacitor";
import { HttpClient } from "@angular/common/http";
import { firstValueFrom, timeout } from "rxjs";

import { RunningContextService } from "./running-context.service";
import { LoggingService } from "./logging.service";
import { ToastService } from "./toast.service";
import { ResourcesService } from "./resources.service";
import { SetOfflineAvailableAction } from "../reducers/offline.reducer";
import { Urls } from "../urls";
import type { ApplicationState } from "../models";

const OFFLINE_MAPS_SUBSCRIPTION = "offline_map";

@Injectable()
export class PurchaseService {

    private readonly runningContextService = inject(RunningContextService);
    private readonly loggingService = inject(LoggingService);
    private readonly httpClient = inject(HttpClient);
    private readonly toastService = inject(ToastService);
    private readonly resources = inject(ResourcesService);
    private readonly store = inject(Store);

    public async initialize() {
        if (!this.runningContextService.isCapacitor) {
            return;
        }

        this.store.select((state: ApplicationState) => state.userState.userInfo).subscribe(async (userInfo) => {
            if (userInfo == null) {
                return;
            }
            this.loggingService.info("[Store] Logged in: " + userInfo.id);
            this.initializeStoreConnection(userInfo.id);

            if (await this.isExpired()) {
                this.loggingService.debug("[Store] Product is expired from server");
                this.store.dispatch(new SetOfflineAvailableAction(false));
            }
        });
    }

    private async isExpired(): Promise<boolean> {
        try {
            return !(await firstValueFrom(this.httpClient.get<boolean>(Urls.subscribed).pipe(timeout(5000))));
        } catch {
            return false;
        }
    }

    private async checkAndUpdateOfflineAvailability(fromOrder: boolean) {
        const customerInfo = await Purchases.getCustomerInfo();
        if (customerInfo.customerInfo.entitlements.active[OFFLINE_MAPS_SUBSCRIPTION]?.isActive) {
            this.loggingService.info("[Store] Product owned! Last modified: " + customerInfo.customerInfo.entitlements.active[OFFLINE_MAPS_SUBSCRIPTION]?.latestPurchaseDate);
            this.store.dispatch(new SetOfflineAvailableAction(true));
            // HM TODO: remove this after we finish debugging this issue
            try {
                this.logToServer("User ID from App: " + this.store.selectSnapshot((s: ApplicationState) => s.userState.userInfo)?.id +
                    ", User ID from Store: " + (await Purchases.getAppUserID())?.appUserID +
                    ", From Order: " + fromOrder +
                    ", Last Purchase Date: " + customerInfo.customerInfo.entitlements.active[OFFLINE_MAPS_SUBSCRIPTION]?.latestPurchaseDate
                );
            } catch (error) {
                this.loggingService.error("[Store] Failed to log offline availability: " + (error as any).message);
            }
        }
    }



    private async initializeStoreConnection(userId: string) {
        let log = "";
        await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG });
        await Purchases.setLogHandler((_logLevel, message) => {
            log += userId + " | " + message + "\n";
        });
        try {
            const apiKey = this.runningContextService.isIos ? "appl_dYhzcYSUYYFWbXBeHYPMsDmraQp" : "goog_WFtGQuaZOimKuqvxOLUYNoekMbQ";
            const isConfigured = (await Purchases.isConfigured()).isConfigured;
            if (!isConfigured && userId) {
                await Purchases.configure({
                    apiKey,
                    appUserID: `${userId}`
                });
            } else if (!userId) {
                await this.logToServer("User is empty, User ID from Store: " + (await Purchases.getAppUserID())?.appUserID);
            } else if (isConfigured) {
                await this.logToServer("Configured was already called before, User ID from App: " + userId + ", User ID from Store: " + (await Purchases.getAppUserID())?.appUserID);
                await Purchases.logIn({ appUserID: `${userId}` });
            }
            if ((await Purchases.isAnonymous()).isAnonymous && userId) {
                await this.logToServer(`User ${userId} is still anonymous after configure. Logs:\n${log}`);
            }
            this.checkAndUpdateOfflineAvailability(false);
        } catch (error) {
            this.loggingService.error("[Store] Failed to get customer info: " + (error as any).message);
            this.logToServer("Failed to configure the store for user: " + userId + ", " + (error as any).message);
        } finally {
            await Purchases.setLogHandler(() => { });
            await Purchases.setLogLevel({ level: LOG_LEVEL.ERROR });
        }
    }

    private async logToServer(message: string) {
        try {
            await firstValueFrom(this.httpClient.post(Urls.log, { message: "v3 | " + message }).pipe(timeout(5000)));
        } catch { }
    }

    public order() {
        if (this.runningContextService.isIos) {
            this.toastService.confirm({
                message: this.resources.subscriptionDetails,
                type: "Custom",
                customConfirmText: this.resources.continue,
                customDeclineText: this.resources.cancel,
                confirmAction: () => {
                    this.orderInternal()
                },
            });
        } else {
            this.orderInternal();
        }
        
    }

    private async orderInternal() {
        this.loggingService.info("[Store] Ordering product");
        const offerings = await Purchases.getOfferings();

        const appUserId = (await Purchases.getAppUserID())?.appUserID;
        const osmUserId = this.store.selectSnapshot((s: ApplicationState) => s.userState.userInfo)?.id;
        if (appUserId !== osmUserId) {
            this.logToServer("Inside order flow but users do not match, User ID from App: " + osmUserId + ", User ID from Store: " + appUserId);
        }

        await Purchases.purchasePackage({
            aPackage: offerings.current.annual
        });
        await this.checkAndUpdateOfflineAvailability(true);
    }

    public isPurchaseAvailable(): boolean {
        const offlineState = this.store.selectSnapshot((s: ApplicationState) => s.offlineState);
        return this.runningContextService.isCapacitor &&
            !offlineState.isOfflineAvailable &&
            offlineState.lastModifiedDate == null;
    }

    public isRenewAvailable() {
        const offlineState = this.store.selectSnapshot((s: ApplicationState) => s.offlineState);
        return this.runningContextService.isCapacitor &&
            !offlineState.isOfflineAvailable &&
            offlineState.lastModifiedDate != null;
    }
}
