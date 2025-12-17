import { Component, inject } from "@angular/core";
import { Dir } from "@angular/cdk/bidi";
import { MatButton, MatAnchor } from "@angular/material/button";
import { MatDialog, MatDialogTitle, MatDialogClose, MatDialogActions } from "@angular/material/dialog";

import { Angulartics2OnModule } from "../../directives/gtag.directive";
import { ResourcesService } from "../../services/resources.service";

@Component({
    selector: "facebook-warning-dialog",
    templateUrl: "./facebook-warning-dialog.component.html",
    imports: [Dir, MatDialogTitle, MatButton, MatDialogClose, MatDialogActions, MatAnchor, Angulartics2OnModule]
})
export class FacebookWarningDialogComponent {

    public readonly resources = inject(ResourcesService);

    public static openDialog(dialog: MatDialog) {
        dialog.open(FacebookWarningDialogComponent, {
            hasBackdrop: false,
            maxWidth: "100vw",
            width: "100%",
            position: {
                bottom: "0px"
            }
        });
    }
}
