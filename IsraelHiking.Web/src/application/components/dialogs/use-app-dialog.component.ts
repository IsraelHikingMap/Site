import { Component, inject } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";

import { ResourcesService } from "../../services/resources.service";
import { RunningContextService } from "../../services/running-context.service";

@Component({
    selector: "use-app-dialog",
    templateUrl: "./use-app-dialog.component.html",
    standalone: false
})
export class UseAppDialogComponent {
    public appAddress: string;

    public readonly resources = inject(ResourcesService);

    private readonly runningContextServive = inject(RunningContextService);

    constructor() {
        this.appAddress = this.runningContextServive.isIos
            ? "https://apps.apple.com/us/app/israel-hiking-map/id1451300509"
            : "https://play.google.com/store/apps/details?id=il.org.osm.israelhiking&hl=en";
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
