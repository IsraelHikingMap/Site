import { inject, Injectable } from "@angular/core";
import { Store } from "@ngxs/store";
import { Qonversion, QonversionConfigBuilder, LaunchMode, UserPropertyKey} from "@qonversion/capacitor-plugin";
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
        const entitlements = await Qonversion.getSharedInstance().checkEntitlements();
        const premiumEntitlement = entitlements.get(OFFLINE_MAPS_SUBSCRIPTION);
        if (premiumEntitlement?.isActive) {
            this.loggingService.info("[Store] Product owned! Last modified: " + premiumEntitlement.lastPurchaseDate);
            this.store.dispatch(new SetOfflineAvailableAction(true));
        }
    }

    private async initializeStoreConnection(userId: string) {
        try {
            const config = new QonversionConfigBuilder(
                "5k-mmshtDq9TkwaMwFeBh2EkoejQFWKy",
                LaunchMode.SUBSCRIPTION_MANAGEMENT,
            ).build();
            Qonversion.initialize(config);
            Qonversion.getSharedInstance().setUserProperty(UserPropertyKey.CUSTOM_USER_ID, userId.toString());
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
        
        try {
            const offerings = await Qonversion.getSharedInstance().offerings();
            const product = offerings.availableOffering[0].products[0];
            await Qonversion.getSharedInstance().purchaseProduct(product, null);
            await this.checkAndUpdateOfflineAvailability();
        } catch (e) {
            this.loggingService.error("[Store] Failed to order product: " + (e as any).message);
        }
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
