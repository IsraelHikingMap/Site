import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { Store, Select } from "@ngxs/store";
import 'cordova-plugin-purchase';

import { RunningContextService } from "./running-context.service";
import { LoggingService } from "./logging.service";
import { OfflineFilesDownloadService } from "./offline-files-download.service";
import { SetOfflineAvailableAction } from "../reducers/offline.reducer";
import type { ApplicationState, UserInfo } from "../models/models";

const OFFLINE_MAPS_SUBSCRIPTION = "offline_map";

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
        
        this.userInfo$.subscribe(userInfo => {
            if (userInfo == null) {
                return;
            }
            this.loggingService.info("[Store] Logged in: " + userInfo.id);
            this.initializeCdvStore(userInfo.id);
            this.offlineFilesDownloadService.isExpired().then((isExpired) => {
                if (isExpired) {
                    this.loggingService.debug("[Store] Product is expired from server");
                    this.store.dispatch(new SetOfflineAvailableAction(false));
                }
            });
        });
    }

    private async initializeCdvStore(userId: string) {
        CdvPurchase.Logger.console = {
            error: (message: string | unknown) => this.loggingService.error(this.logMessageToString(message)),
            warn: (message: string | unknown) => this.loggingService.warning(this.logMessageToString(message)),
            log: (message: string | unknown) => this.loggingService.info(this.logMessageToString(message))
        };
        CdvPurchase.store.validator = "https://validator.iaptic.com/v1/validate?appName=il.org.osm.israelhiking" +
            "&apiKey=1245b587-4bbc-4fbd-a3f1-d51169a53063";
        CdvPurchase.store.applicationUsername = userId;
        CdvPurchase.store.register([{
            id: OFFLINE_MAPS_SUBSCRIPTION,
            type: CdvPurchase.ProductType.PAID_SUBSCRIPTION,
            platform: CdvPurchase.Platform.GOOGLE_PLAY
        }, {
            id: OFFLINE_MAPS_SUBSCRIPTION,
            type: CdvPurchase.ProductType.PAID_SUBSCRIPTION,
            platform: CdvPurchase.Platform.APPLE_APPSTORE
        }]);
        CdvPurchase.store.when().approved((transaction) => {
            return transaction.verify();
        });
        CdvPurchase.store.when().unverified((unverified) => {
            this.loggingService.info(`[Store] Unverified: ${unverified.payload.code} ${unverified.payload.message}`);
        });
        CdvPurchase.store.when().verified((receipt) => {
            if (CdvPurchase.store.owned(OFFLINE_MAPS_SUBSCRIPTION)) {
                let offlineState = this.store.selectSnapshot((s: ApplicationState) => s.offlineState);
                this.loggingService.info("[Store] Product owned! Last modified: " + offlineState.lastModifiedDate);
                this.store.dispatch(new SetOfflineAvailableAction(true));
            }
            receipt.finish();
        });
        CdvPurchase.store.verbosity = CdvPurchase.LogLevel.WARNING;
        await CdvPurchase.store.initialize();
    }

    public order() {
        this.loggingService.info("[Store] Ordering product");
        const offer = CdvPurchase.store.get(OFFLINE_MAPS_SUBSCRIPTION).getOffer();
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
