import { Component } from "@angular/core";
import { MdDialog } from "@angular/material";
import { ResourcesService } from "../services/ResourcesService";
import { OsmUserService } from "../services/OsmUserService";
import { ToastService } from "../services/ToastService";
import { BaseMapComponent } from "./BaseMapComponent";
import { OsmUserDialogComponent } from "./dialogs/OsmUserDialogComponent";

@Component({
    selector: "osm-user",
    moduleId: module.id,
    templateUrl: "osmuser.html"
})
export class OsmUserComponent extends BaseMapComponent {

    constructor(resources: ResourcesService,
        public userService: OsmUserService,
        private dialog: MdDialog,
        private toastService: ToastService,
    ) {
        super(resources);
    }

    public login(e: Event) {
        this.suppressEvents(e);
        this.userService.login().then(() => { }, () => {
            this.toastService.warning(this.resources.unableToLogin);
        });
    }

    public openUserDetails(e: Event) {
        this.suppressEvents(e);
        this.userService.refreshDetails();
        this.dialog.open(OsmUserDialogComponent, { width: "768px" });
    }
}