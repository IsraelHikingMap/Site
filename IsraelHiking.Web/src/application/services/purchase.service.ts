import { inject, Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Store } from "@ngxs/store";
import { firstValueFrom, timeout } from "rxjs";
import { PAYWALL_RESULT, Purchases } from "@revenuecat/purchases-capacitor";
import { RevenueCatUI } from '@revenuecat/purchases-capacitor-ui';

import { RunningContextService } from "./running-context.service";
import { LoggingService } from "./logging.service";
import { SetOfflineSubscribedAction } from "../reducers/offline.reducer";
import { IncrementAppLaunchesSinceLastPaywallShown, SetLastPaywallShownDate } from "../reducers/paywall.reducer";
import { Urls } from "../urls";
import type { ApplicationState } from "../models";

const OFFLINE_MAPS_SUBSCRIPTION = "offline_map";

@Injectable()
export class PurchaseService {

    private readonly runningContextService = inject(RunningContextService);
    private readonly loggingService = inject(LoggingService);
    private readonly httpClient = inject(HttpClient);
    private readonly store = inject(Store);

    public async initialize() {
        if (!this.runningContextService.isCapacitor) {
            return;
        }
        this.store.dispatch(new IncrementAppLaunchesSinceLastPaywallShown());
        this.store.select((state: ApplicationState) => state.userState.userInfo).subscribe(async (userInfo) => {
            if (userInfo == null) {
                return;
            }
            this.loggingService.info("[Store] Logged in: " + userInfo.id);
            await this.initializeStoreConnection(userInfo.id);

            if (await this.isExpired()) {
                this.loggingService.debug("[Store] Product is expired from server");
                this.store.dispatch(new SetOfflineSubscribedAction(false));
            } else {
                // HM TODO: remove this after setup puchase from the stores
                this.loggingService.debug("[Store] Product is valid from server");
                this.store.dispatch(new SetOfflineSubscribedAction(true));
            }

            if (this.shouldShowPaywall()) {
                this.showPaywall();
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
            this.store.dispatch(new SetOfflineSubscribedAction(true));
        }
    }

    private async initializeStoreConnection(userId: string) {
        try {
            const apiKey = this.runningContextService.isIos ? "appl_OKCoIjEkNVfloKjpNfNaAdgGOwO" : "goog_NEtHVocOwpDpmIcHEETTdUdrtpd";
            const isConfigured = (await Purchases.isConfigured()).isConfigured;
            if (!isConfigured && userId) {
                await Purchases.configure({
                    apiKey,
                    appUserID: `${userId}`
                });
            } else if (isConfigured) {
                await Purchases.logIn({ appUserID: `${userId}` });
            }
            this.checkAndUpdateOfflineAvailability();
        } catch (error) {
            this.loggingService.error("[Store] Failed to initialize purchases connection: " + (error as any).message);
        }
    }

    public async showPaywall() {
        this.loggingService.info("[Store] Presenting paywall");
        this.store.dispatch(new SetLastPaywallShownDate(new Date()));
        const { result } = await RevenueCatUI.presentPaywall({ displayCloseButton: true });
        this.loggingService.info("[Store] Paywall result: " + result);
        if (result === PAYWALL_RESULT.PURCHASED) {
            this.orderInternal();
        }
    }

    private async orderInternal() {
        this.loggingService.info("[Store] Ordering product");
        const offerings = await Purchases.getOfferings();

        try {
            await Purchases.purchasePackage({
                aPackage: offerings.current.annual
            });
            await this.checkAndUpdateOfflineAvailability();
        } catch (error) {
            this.loggingService.error("[Store] Failed to purchase product: " + (error as any).message);
            await Purchases.syncPurchases();
            await this.checkAndUpdateOfflineAvailability();
        }
    }

    public isPurchaseAvailable(): boolean {
        const offlineState = this.store.selectSnapshot((s: ApplicationState) => s.offlineState);
        return this.runningContextService.isCapacitor &&
            !offlineState.isSubscribed &&
            offlineState.downloadedTiles == null;
    }

    public isRenewAvailable() {
        const offlineState = this.store.selectSnapshot((s: ApplicationState) => s.offlineState);
        return this.runningContextService.isCapacitor &&
            !offlineState.isSubscribed &&
            offlineState.downloadedTiles != null;
    }

    private shouldShowPaywall(): boolean {
        const paywallState = this.store.selectSnapshot((s: ApplicationState) => s.paywallState);
        if (!this.runningContextService.isCapacitor) {
            return false;
        }

        if (this.store.selectSnapshot((s: ApplicationState) => s.userState.userInfo) == null) {
            return false;
        }

        if (this.store.selectSnapshot((s: ApplicationState) => s.offlineState.isSubscribed)) {
            return false;
        }

        if (paywallState.lastPaywallShownDate == null) {
            return true;
        }

        const daysSinceLastPaywallShown = (new Date().getTime() - new Date(paywallState.lastPaywallShownDate).getTime()) / (1000 * 60 * 60 * 24);

        if (daysSinceLastPaywallShown > 14) {
            return true;
        }

        if (daysSinceLastPaywallShown > 7 && paywallState.appLaunchesSinceLastPaywallShown > 7) {
            return true;
        }

        if (new Date(paywallState.lastOfflineDetectedDate) > new Date(paywallState.lastPaywallShownDate)) {
            return true;
        }

        return false;
    }
}
