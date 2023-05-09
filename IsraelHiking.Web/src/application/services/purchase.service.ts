import { Injectable } from "@angular/core";
import { InAppPurchase2 } from "@awesome-cordova-plugins/in-app-purchase-2/ngx";
import { Observable } from "rxjs";
import { Store, Select } from "@ngxs/store";

import { RunningContextService } from "./running-context.service";
import { LoggingService } from "./logging.service";
import { OfflineFilesDownloadService } from "./offline-files-download.service";
import { SetOfflineAvailableAction } from "../reducers/offline.reducer";
import type { ApplicationState, UserInfo } from "../models/models";

@Injectable()
export class PurchaseService {

    @Select((state: ApplicationState) => state.userState.userInfo)
    private userInfo$: Observable<UserInfo>;

    constructor(private readonly inAppPurchase: InAppPurchase2,
                private readonly runningContextService: RunningContextService,
                private readonly loggingService: LoggingService,
                private readonly offlineFilesDownloadService: OfflineFilesDownloadService,
                private readonly store: Store) {
    }

    public initialize() {
        if (!this.runningContextService.isCapacitor) {
            return;
        }

        this.inAppPurchase.log = {
            error: (message: string | unknown) => this.loggingService.error(this.logMessageToString(message)),
            warn: (message: string | unknown) => this.loggingService.warning(this.logMessageToString(message)),
            info: (message: string | unknown) => this.loggingService.info(this.logMessageToString(message)),
            debug: (message: string | unknown) => this.loggingService.debug(this.logMessageToString(message)),
        };
        this.inAppPurchase.validator = "https://validator.fovea.cc/v1/validate?appName=il.org.osm.israelhiking" +
            "&apiKey=1245b587-4bbc-4fbd-a3f1-d51169a53063";
        this.inAppPurchase.error((e: { code: number; message: string }) => {
            this.loggingService.error(`[Store] error handler: ${e.message} (${e.code})`);
        });

        this.inAppPurchase.register({
            id: "offline_map",
            alias: "offline map",
            type: this.inAppPurchase.PAID_SUBSCRIPTION
        });
        this.inAppPurchase.when("offline_map").owned(() => {
            let offlineState = this.store.selectSnapshot((s: ApplicationState) => s.offlineState);
            this.loggingService.debug("[Store] Product owned! Last modified: " + offlineState.lastModifiedDate);
            this.store.dispatch(new SetOfflineAvailableAction(true));
            return;
        });
        this.inAppPurchase.when("offline_map").expired(() => {
            this.loggingService.debug("[Store] Product expired...");
            this.store.dispatch(new SetOfflineAvailableAction(false));
            return;
        });
        this.inAppPurchase.when("product").approved((product: any) => {
            this.loggingService.debug(`[Store] Approved, verifing: ${product.id}`);
            return product.verify();
        });
        this.inAppPurchase.when("product").verified((product: any) => {
            this.loggingService.debug(`[Store] Verified, Finishing: ${product.id}`);
            product.finish();
        });

        this.userInfo$.subscribe(userInfo => {
            if (userInfo == null) {
                return;
            }
            this.loggingService.info("[Store] logged in: " + userInfo.id);
            this.inAppPurchase.applicationUsername = userInfo.id;
            this.inAppPurchase.refresh();
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
        this.inAppPurchase.order("offline_map");
    }

    private logMessageToString(message: string | unknown): string {
        if (typeof message !== "string") {
            return `[Store] ${JSON.stringify(message)}`;
        }
        return `[Store] ${message}`;
    }
}
