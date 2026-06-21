import { Component, inject } from "@angular/core";
import { Dir } from "@angular/cdk/bidi";
import { MatButton, MatAnchor , MatIconButton } from "@angular/material/button";
import { MatDialog, MatDialogTitle, MatDialogClose, MatDialogActions } from "@angular/material/dialog";

import { AnalyticsDirective } from "../../directives/analytics.directive";
import { ResourcesService } from "../../services/resources.service";

@Component({
    selector: "facebook-warning-dialog",
    templateUrl: "./facebook-warning-dialog.component.html",
    imports: [MatIconButton, Dir, MatDialogTitle, MatButton, MatDialogClose, MatDialogActions, MatAnchor, AnalyticsDirective]
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
