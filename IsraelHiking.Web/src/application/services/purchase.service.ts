import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { Store, Select } from "@ngxs/store";
import 'cordova-plugin-purchase';

import { RunningContextService } from "./running-context.service";
import { LoggingService } from "./logging.service";
import { OfflineFilesDownloadService } from "./offline-files-download.service";
import { SetOfflineAvailableAction } from "../reducers/offline.reducer";
import type { ApplicationState, UserInfo } from "../models/models";

@Injectable()
export class PurchaseService {

    @Select((state: ApplicationState) => state.userState.userInfo)
    private userInfo$: Observable<UserInfo>;

    constructor(private readonly runningContextService: RunningContextService,
                private readonly loggingService: LoggingService,
                private readonly offlineFilesDownloadService: OfflineFilesDownloadService,
                private readonly store: Store) {
    }

    public async initialize() {
        if (!this.runningContextService.isCapacitor) {
            return;
        }

        CdvPurchase.Logger.console = {
            error: (message: string | unknown) => this.loggingService.error(this.logMessageToString(message)),
            warn: (message: string | unknown) => this.loggingService.warning(this.logMessageToString(message)),
            log: (message: string | unknown) => this.loggingService.info(this.logMessageToString(message))
        };
        CdvPurchase.store.validator = "https://validator.fovea.cc/v1/validate?appName=il.org.osm.israelhiking" +
            "&apiKey=1245b587-4bbc-4fbd-a3f1-d51169a53063";

        await CdvPurchase.store.initialize();
        CdvPurchase.store.register([{
            id: "offline_map",
            type: CdvPurchase.ProductType.PAID_SUBSCRIPTION,
            platform: CdvPurchase.Platform.GOOGLE_PLAY
        }, {
            id: "offline_map",
            type: CdvPurchase.ProductType.PAID_SUBSCRIPTION,
            platform: CdvPurchase.Platform.APPLE_APPSTORE
        }]);

        CdvPurchase.store.when().finished(() => {
            if (CdvPurchase.store.owned("offline_map")) {
                let offlineState = this.store.selectSnapshot((s: ApplicationState) => s.offlineState);
                this.loggingService.debug("[Store] Product owned! Last modified: " + offlineState.lastModifiedDate);
                this.store.dispatch(new SetOfflineAvailableAction(true));
            }
        });
        CdvPurchase.store.when().approved((transaction) => {
            this.loggingService.debug(`[Store] Approved, verifing: ${transaction.transactionId}`);
            return transaction.verify();
        });
        CdvPurchase.store.when().verified((receipt) => {
            this.loggingService.debug(`[Store] Verified, Finishing: ${receipt.id}`);
            receipt.finish();
        });
        this.userInfo$.subscribe(userInfo => {
            if (userInfo == null) {
                return;
            }
            this.loggingService.info("[Store] logged in: " + userInfo.id);
            CdvPurchase.store.applicationUsername = userInfo.id;
            CdvPurchase.store.update();
            this.offlineFilesDownloadService.isExpired().then((isExpired) => {
                if (isExpired) {
                    this.loggingService.debug("[Store] Product is expired from server");
                    this.store.dispatch(new SetOfflineAvailableAction(false));
                }
            });
        });
    }

    public order() {
        this.loggingService.debug("[Store] Ordering product");
        const offer = CdvPurchase.store.get("offline_map").getOffer();
        offer.order();
    }

    private logMessageToString(message: string | unknown): string {
        if (typeof message !== "string") {
            return `[Store] ${JSON.stringify(message)}`;
        }
        return `[Store] ${message}`;
    }

    public isPurchaseAvailable(): boolean {
        let offlineState = this.store.selectSnapshot((s: ApplicationState) => s.offlineState);
        return this.runningContextService.isCapacitor &&
            !offlineState.isOfflineAvailable &&
            offlineState.lastModifiedDate == null;
    }

    public isRenewAvailable() {
        let offlineState = this.store.selectSnapshot((s: ApplicationState) => s.offlineState);
        return this.runningContextService.isCapacitor &&
            !offlineState.isOfflineAvailable &&
            offlineState.lastModifiedDate != null;
    }
}
