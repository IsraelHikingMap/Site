import { Injectable } from "@angular/core";
import { InAppPurchase2, IAPProduct } from "@ionic-native/in-app-purchase-2/ngx";

import { RunningContextService } from "./running-context.service";

@Injectable()
export class PurchaseService {
    public isOfflineAvailable: boolean;

    constructor(private readonly store: InAppPurchase2,
                private readonly runningContextService: RunningContextService) {
        // HM TODO: change this to false
        this.isOfflineAvailable = true;
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
        this.store.when("product").updated((p: IAPProduct) => {
            if (p.owned) {
                this.isOfflineAvailable = true;
                return;
            }
        });
        this.store.when("product").approved(product => product.verify());
        this.store.when("product").verified(product => product.finish());
        this.store.refresh();
    }

    public order(applicationUsername: string) {
        this.store.order("offline_map", { applicationUsername });
    }
}
