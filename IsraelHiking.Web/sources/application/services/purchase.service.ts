import { Injectable } from "@angular/core";
import { NgRedux, select } from "@angular-redux/store";
import { InAppPurchase2, IAPProduct } from "@ionic-native/in-app-purchase-2/ngx";
import { Observable } from "rxjs";

import { RunningContextService } from "./running-context.service";
import { LoggingService } from "./logging.service";
import { SetOfflineAvailableAction } from "../reducres/offline.reducer";
import { ApplicationState, UserInfo } from "../models/models";

@Injectable()
export class PurchaseService {

    @select((state: ApplicationState) => state.userState.userInfo)
    private userInfo$: Observable<UserInfo>;

    constructor(private readonly store: InAppPurchase2,
                private readonly runningContextService: RunningContextService,
                private readonly loggingService: LoggingService,
                private readonly ngRedux: NgRedux<ApplicationState>) {
    }

    public initialize() {
        if (!this.runningContextService.isCordova) {
            return;
        }
        this.userInfo$.subscribe(ui => {
            if (ui != null) {
                //this.loggingService.info(`[Store] logged in: ` + ui.id);
                //this.store.applicationUsername = ui.id;
                //this.store.refresh();
            }
        });

        this.store.log = {
            error: (message: string | object) => this.loggingService.error(this.logMessageToString(message)),
            warn: (message: string | object) => this.loggingService.warning(this.logMessageToString(message)),
            info: (message: string | object) => this.loggingService.info(this.logMessageToString(message)),
            debug: (message: string | object) => this.loggingService.debug(this.logMessageToString(message)),
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
            this.loggingService.debug("[Store] Product owned!");
            this.ngRedux.dispatch(new SetOfflineAvailableAction({ isAvailble: true }));
            return;
        });
        this.store.when("offline_map").expired(() => {
            this.loggingService.debug("[Store] Product expired...");
            this.ngRedux.dispatch(new SetOfflineAvailableAction({ isAvailble: false }));
            return;
        });
        this.store.when("product").approved(product => {
            this.loggingService.debug(`[Store] Approved, verifing: ${product.id}`);
            return product.verify();
        });
        this.store.when("product").verified(product => {
            this.loggingService.debug(`[Store] Verified, Finishing: ${product.id}`);
            product.finish();
        });
        this.store.when("product").updated((p: IAPProduct) => {
            this.loggingService.debug(`[Store] Updated: ${p.id}\n${JSON.stringify(p, null, 4)}`);
            if (p.owned) {
                this.loggingService.debug(`[Store] owned: ${p.id}`);
            }
            if (new Date(p.expiryDate) < new Date()) {
                this.loggingService.debug(`[Store] expired: ${p.id}`);
            }
        });
        
        this.store.refresh();
    }

    public order(applicationUsername: string) {
        this.loggingService.debug("[Store] Ordering product for: " + applicationUsername);
        this.store.order("offline_map", { applicationUsername });
    }

    private logMessageToString(message: string | object): string {
        if (typeof message !== "string") {
            return `[Store] ${JSON.stringify(message)}`;
        }
        return `[Store] ${message}`;
    }
}
