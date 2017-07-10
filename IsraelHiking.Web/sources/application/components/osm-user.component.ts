import { Component } from "@angular/core";
import { MdDialog } from "@angular/material";
import { ResourcesService } from "../services/resources.service";
import { OsmUserService } from "../services/osm-user.service";
import { ToastService } from "../services/toast.service";
import { BaseMapComponent } from "./base-map.component";
import { OsmUserDialogComponent } from "./dialogs/osm-user-dialog.component";

@Component({
    selector: "osm-user",
    templateUrl: "./osm-user.component.html"
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
        this.dialog.open(OsmUserDialogComponent, { width: "768px" });
    }
}