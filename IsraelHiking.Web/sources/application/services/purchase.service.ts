import { Injectable } from "@angular/core";
import { InAppPurchase2, IAPProduct } from "@ionic-native/in-app-purchase-2/ngx";
import { HttpClient } from "@angular/common/http";
import { MatDialog } from "@angular/material";

import { RunningContextService } from "./running-context.service";
import { DownloadProgressDialogComponent } from "../components/dialogs/download-progress-dialog.component";

@Injectable()
export class PurchaseService {
    constructor(private readonly store: InAppPurchase2,
                private readonly runningContextService: RunningContextService,
                private readonly matDialog: MatDialog) {
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
                this.openDialogIfNeeded();
                return;
            }
        });
        this.store.when("product").approved(product => product.verify());
        this.store.when("product").verified(product => product.finish());
        this.store.refresh();
    }

    public order(applicationUsername: string) {
        // HM TODO: switch back
        // this.store.order("offline_map", { applicationUsername });
        this.openDialogIfNeeded();
    }

    private openDialogIfNeeded() {
        // HM TODO: check what needs to be updated
        let needUpdate = true;
        if (needUpdate) {
            this.matDialog.open(DownloadProgressDialogComponent);
        }
    }
}
