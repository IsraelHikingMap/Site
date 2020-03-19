import { Injectable } from "@angular/core";
import { NgRedux } from "@angular-redux/store";
import { InAppPurchase2, IAPProduct } from "@ionic-native/in-app-purchase-2/ngx";

import { RunningContextService } from "./running-context.service";
import { LoggingService } from "./logging.service";
import { SetOfflineAvailableAction } from "../reducres/offline.reducer";
import { ApplicationState } from "../models/models";

@Injectable()
export class PurchaseService {

    constructor(private readonly store: InAppPurchase2,
                private readonly runningContextService: RunningContextService,
                private readonly loggingService: LoggingService,
                private readonly ngRedux: NgRedux<ApplicationState>) {
    }

    public initialize() {
        if (!this.runningContextService.isCordova) {
            return;
        }
        this.store.validator = "https://validator.fovea.cc/v1/validate?appName=il.org.osm.israelhiking" +
            "&apiKey=1245b587-4bbc-4fbd-a3f1-d51169a53063";
        this.store.register({
            id: "offline_map",
            alias: "offline map",
            type: this.store.PAID_SUBSCRIPTION
        });
        this.store.when("offline_map").owned(() => {
            this.loggingService.debug("Product owned!");
            this.ngRedux.dispatch(new SetOfflineAvailableAction({ isAvailble: true }));
            return;
        });
        this.store.when("offline_map").expired(() => {
            this.loggingService.debug("Product expired...");
            this.ngRedux.dispatch(new SetOfflineAvailableAction({ isAvailble: false }));
            return;
        });
        this.store.when("product").approved(product => product.verify());
        this.store.when("product").verified(product => product.finish());
        this.store.refresh();
    }

    public order(applicationUsername: string) {
        this.loggingService.debug("Ordering product for: " + applicationUsername);
        this.store.order("offline_map", { applicationUsername });
    }
}
