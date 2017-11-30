import { Component } from "@angular/core";
import { MatDialog } from "@angular/material";
import { LocalStorage } from "ngx-store"; 

import { ResourcesService } from "../services/resources.service";
import { OsmUserService } from "../services/osm-user.service";
import { ToastService } from "../services/toast.service";
import { BaseMapComponent } from "./base-map.component";
import { OsmUserDialogComponent } from "./dialogs/osm-user-dialog.component";
import {TermsOfServiceDialogComponent} from "./dialogs/terms-of-service-dialog.component";

@Component({
    selector: "osm-user",
    templateUrl: "./osm-user.component.html"
})
export class OsmUserComponent extends BaseMapComponent {

    @LocalStorage()
    public agreedToTheTermsOfService: boolean = false;

    constructor(resources: ResourcesService,
        public userService: OsmUserService,
        private dialog: MatDialog,
        private toastService: ToastService) {
        super(resources);
    }

    public login(e: Event) {
        this.suppressEvents(e);
        if (!this.agreedToTheTermsOfService) {
            let component = this.dialog.open(TermsOfServiceDialogComponent);
            component.afterClosed().subscribe((results: string) => {
                if (results === "true") {
                    this.agreedToTheTermsOfService = true;
                }
            });
        } else {
            this.userService.login().then(() => { }, () => {
                this.toastService.warning(this.resources.unableToLogin);
            });
        }
    }

    public openUserDetails(e: Event) {
        this.suppressEvents(e);
        this.dialog.open(OsmUserDialogComponent, { width: "768px" });
    }
}