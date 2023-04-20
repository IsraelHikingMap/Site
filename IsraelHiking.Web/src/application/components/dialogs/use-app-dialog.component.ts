import { Component } from "@angular/core";
import { MatLegacyDialog as MatDialog } from "@angular/material/legacy-dialog";

import { BaseMapComponent } from "../base-map.component";
import { ResourcesService } from "../../services/resources.service";
import { RunningContextService } from "../../services/running-context.service";

@Component({
    selector: "use-app-dialog",
    templateUrl: "./use-app-dialog.component.html"
})
export class UseAppDialogComponent extends BaseMapComponent {
    public appAddress: string;

    constructor(resources: ResourcesService,
                private readonly runningContextServive: RunningContextService) {
        super(resources);
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
