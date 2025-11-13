import { Component, inject } from "@angular/core";
import { Dir } from "@angular/cdk/bidi";
import { MatButton, MatAnchor } from "@angular/material/button";
import { MatDialog, MatDialogTitle, MatDialogClose, MatDialogActions } from "@angular/material/dialog";
import { Angulartics2OnModule } from "angulartics2";

import { ResourcesService } from "../../services/resources.service";
import { RunningContextService } from "../../services/running-context.service";
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
    public readonly resources = inject(ResourcesService);

    public isAndroid() {
        return !this.runningContextServive.isIos;
    }

    public static openDialog(dialog: MatDialog) {
        dialog.open(MigrateToMapeakDialogComponent);
    }
}