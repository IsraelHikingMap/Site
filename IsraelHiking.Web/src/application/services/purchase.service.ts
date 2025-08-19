import { inject, Injectable } from "@angular/core";
import { Store } from "@ngxs/store";
import { Purchases } from "@revenuecat/purchases-capacitor";
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

    private async checkAndUpdateOfflineAvailability() {
        const customerInfo = await Purchases.getCustomerInfo();
        if (customerInfo.customerInfo.entitlements.active[OFFLINE_MAPS_SUBSCRIPTION]?.isActive) {
            this.loggingService.info("[Store] Product owned! Last modified: " + customerInfo.customerInfo.entitlements.active[OFFLINE_MAPS_SUBSCRIPTION]?.latestPurchaseDate);
            this.store.dispatch(new SetOfflineAvailableAction(true));
        }
    }

    private async initializeStoreConnection(userId: string) {
        try {
            const apiKey = this.runningContextService.isIos ? "appl_dYhzcYSUYYFWbXBeHYPMsDmraQp" : "goog_WFtGQuaZOimKuqvxOLUYNoekMbQ";
            await Purchases.configure({
                apiKey,
                appUserID: userId
            });
            this.checkAndUpdateOfflineAvailability();
        } catch (error) {
            this.loggingService.error("[Store] Failed to get customer info: " + (error as any).message);
        }
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
            
        await Purchases.purchasePackage({
            aPackage: offerings.current.annual
        });
        await this.checkAndUpdateOfflineAvailability();
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
