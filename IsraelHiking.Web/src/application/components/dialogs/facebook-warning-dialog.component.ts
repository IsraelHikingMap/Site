import { Component } from "@angular/core";
import { MatLegacyDialog as MatDialog } from "@angular/material/legacy-dialog";

import { BaseMapComponent } from "../base-map.component";
import { ResourcesService } from "../../services/resources.service";

@Component({
    selector: "facebook-warning-dialog",
    templateUrl: "./facebook-warning-dialog.component.html"
})
export class FacebookWarningDialogComponent extends BaseMapComponent {

    constructor(resources: ResourcesService) {
        super(resources);
    }

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
