import { Injectable } from "@angular/core";
import { InAppPurchase2 } from "@awesome-cordova-plugins/in-app-purchase-2/ngx";
import { Observable } from "rxjs";
import { NgRedux, Select } from "@angular-redux2/store";

import { RunningContextService } from "./running-context.service";
import { LoggingService } from "./logging.service";
import { SetOfflineAvailableAction } from "../reducers/offline.reducer";
import { OfflineFilesDownloadService } from "./offline-files-download.service";
import type { ApplicationState, UserInfo } from "../models/models";

@Injectable()
export class PurchaseService {

    @Select((state: ApplicationState) => state.userState.userInfo)
    private userInfo$: Observable<UserInfo>;

    constructor(private readonly store: InAppPurchase2,
                private readonly runningContextService: RunningContextService,
                private readonly loggingService: LoggingService,
                private readonly offlineFilesDownloadService: OfflineFilesDownloadService,
                private readonly ngRedux: NgRedux<ApplicationState>) {
    }

    public initialize() {
        if (!this.runningContextService.isCapacitor) {
            return;
        }

        this.store.log = {
            error: (message: string | unknown) => this.loggingService.error(this.logMessageToString(message)),
            warn: (message: string | unknown) => this.loggingService.warning(this.logMessageToString(message)),
            info: (message: string | unknown) => this.loggingService.info(this.logMessageToString(message)),
            debug: (message: string | unknown) => this.loggingService.debug(this.logMessageToString(message)),
        };
        this.store.validator = "https://validator.fovea.cc/v1/validate?appName=il.org.osm.israelhiking" +
            "&apiKey=1245b587-4bbc-4fbd-a3f1-d51169a53063";
        this.store.error((e: { code: number; message: string }) => {
            this.loggingService.error(`[Store] error handler: ${e.message} (${e.code})`);
        });

        this.store.register({
            id: "offline_map",
            alias: "offline map",
            type: this.store.PAID_SUBSCRIPTION
        });
        this.store.when("offline_map").owned(() => {
            this.loggingService.debug("[Store] Product owned! Last modified: " + this.ngRedux.getState().offlineState.lastModifiedDate);
            this.ngRedux.dispatch(new SetOfflineAvailableAction({ isAvailble: true }));
            return;
        });
        this.store.when("offline_map").expired(() => {
            this.loggingService.debug("[Store] Product expired...");
            this.ngRedux.dispatch(new SetOfflineAvailableAction({ isAvailble: false }));
            return;
        });
        this.store.when("product").approved((product: any) => {
            this.loggingService.debug(`[Store] Approved, verifing: ${product.id}`);
            return product.verify();
        });
        this.store.when("product").verified((product: any) => {
            this.loggingService.debug(`[Store] Verified, Finishing: ${product.id}`);
            product.finish();
        });

        this.userInfo$.subscribe(userInfo => {
            if (userInfo == null) {
                return;
            }
            this.loggingService.info("[Store] logged in: " + userInfo.id);
            this.store.applicationUsername = userInfo.id;
            this.store.refresh();
            this.offlineFilesDownloadService.isAvailable().then((isAvailble) => {
                if (isAvailble !== undefined) {
                    this.loggingService.debug("[Store] Product is available from server: " + isAvailble);
                    this.ngRedux.dispatch(new SetOfflineAvailableAction({ isAvailble }));
                } else {
                    this.loggingService.debug("[Store] Unable to determine product availibility from server...");
                }
            });
        });
    }

    public order() {
        this.loggingService.debug("[Store] Ordering product");
        this.store.order("offline_map");
    }

    private logMessageToString(message: string | unknown): string {
        if (typeof message !== "string") {
            return `[Store] ${JSON.stringify(message)}`;
        }
        return `[Store] ${message}`;
    }
}
