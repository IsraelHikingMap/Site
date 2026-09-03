import { Component, inject } from "@angular/core";
import { Dir } from "@angular/cdk/bidi";
import { MatButton, MatAnchor } from "@angular/material/button";
import { MatDialog, MatDialogRef, MatDialogTitle, MatDialogClose, MatDialogActions } from "@angular/material/dialog";
import { Angulartics2OnModule } from "angulartics2";

import { ResourcesService } from "../../services/resources.service";
import { RunningContextService } from "../../services/running-context.service";
import { PurchaseService } from "../../services/purchase.service";
import { Urls } from "../../urls";

@Component({
    selector: "migrate-to-mapeak-dialog",
    templateUrl: "./migrate-to-mapeak-dialog.component.html",
    imports: [Dir, MatDialogTitle, MatButton, MatDialogClose, MatDialogActions, MatAnchor, Angulartics2OnModule]
})
export class MigrateToMapeakDialogComponent {
    public androidAppUrl = Urls.ANDROID_APP_URL;
    public iosAppUrl = Urls.IOS_APP_URL;

    private readonly runningContextServive = inject(RunningContextService);
    private readonly purchaseService = inject(PurchaseService);
    private readonly dialogRef = inject(MatDialogRef);
    public readonly resources = inject(ResourcesService);

    constructor() {
        // Sync the purchases of a user that has, or had, a subscription, so that it moves over to Mapeak with them.
        this.dialogRef.afterClosed().subscribe(() => {
            if (this.purchaseService.isOrWasSubscribed()) {
                this.purchaseService.syncPurchases();
            }
        });
    }

    public isAndroid() {
        return !this.runningContextServive.isIos && this.runningContextServive.isMobile;
    }

    public isIos() {
        return this.runningContextServive.isIos;
    }

    public static openDialog(dialog: MatDialog) {
        dialog.open(MigrateToMapeakDialogComponent, {
            maxWidth: "378px"
        });
    }
}