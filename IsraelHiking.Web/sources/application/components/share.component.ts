import { Component } from "@angular/core";
import { MatDialog } from "@angular/material";
import { ResourcesService } from "../services/resources.service";
import { BaseMapComponent } from "./base-map.component";
import { ShareDialogComponent } from "./dialogs/share-dialog.component";

@Component({
    selector: "share",
    templateUrl: "./share.component.html"
})
export class ShareComponent extends BaseMapComponent {

    constructor(resources: ResourcesService,
        private dialog: MatDialog) {
        super(resources);

    }

    public openShare = (e: Event) => {
        this.dialog.open(ShareDialogComponent);
        this.suppressEvents(e);
    }
}
