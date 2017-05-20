import { Component } from "@angular/core";
import { MdDialog } from "@angular/material";
import { ResourcesService } from "../services/ResourcesService";
import { BaseMapComponent } from "./BaseMapComponent";
import { ShareDialogComponent } from "./dialogs/ShareDialogComponent";

@Component({
    selector: "share",
    moduleId: module.id,
    templateUrl: "share.html"
})
export class ShareComponent extends BaseMapComponent {

    constructor(resources: ResourcesService,
        private dialog: MdDialog) {
        super(resources);

    }

    public openShare = (e: Event) => {
        this.dialog.open(ShareDialogComponent);
        this.suppressEvents(e);
    }
}
