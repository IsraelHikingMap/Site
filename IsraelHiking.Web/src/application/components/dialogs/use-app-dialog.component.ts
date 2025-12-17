import { Component, inject } from "@angular/core";
import { Dir } from "@angular/cdk/bidi";
import { MatButton, MatAnchor } from "@angular/material/button";
import { MatDialog, MatDialogTitle, MatDialogClose, MatDialogActions } from "@angular/material/dialog";

import { Urls } from "../../urls";
import { Angulartics2OnModule } from "../../directives/gtag.directive";
import { ResourcesService } from "../../services/resources.service";
import { RunningContextService } from "../../services/running-context.service";

@Component({
    selector: "use-app-dialog",
    templateUrl: "./use-app-dialog.component.html",
    imports: [Dir, MatDialogTitle, MatButton, MatDialogClose, MatDialogActions, MatAnchor, Angulartics2OnModule]
})
export class UseAppDialogComponent {
    public appAddress: string;

    public readonly resources = inject(ResourcesService);

    private readonly runningContextServive = inject(RunningContextService);

    constructor() {
        this.appAddress = this.runningContextServive.isIos
            ? Urls.IOS_APP_URL
            : Urls.ANDROID_APP_URL;
    }

    public static openDialog(dialog: MatDialog) {
        dialog.open(UseAppDialogComponent, {
            hasBackdrop: false,
            maxWidth: "100vw",
            width: "100%",
            position: {
                bottom: "0px"
            }
        });
    }
}
