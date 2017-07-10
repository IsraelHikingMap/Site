import { Component } from "@angular/core";
import { MdDialog } from "@angular/material";
import { BaseMapComponent } from "./base-map.component";
import { ResourcesService } from "../services/resources.service";
import { SidebarService } from "../services/sidebar.service";
import { HashService } from "../services/hash.service";
import { DownloadDialogComponent } from "./dialogs/download-dialog.component";

@Component({
    selector: "info",
    templateUrl: "./info.component.html"
})
export class InfoComponent extends BaseMapComponent {

    constructor(resources: ResourcesService,
        private hashService: HashService,
        private sidebarService: SidebarService,
        private dialog: MdDialog) {
        super(resources);

        if (hashService.download) {
            this.openDownloadDialog();
            this.sidebarService.toggle("info");
        }
    }

    public toggleInfo = (e: Event) => {
        this.sidebarService.toggle("info");
        this.suppressEvents(e);
    };

    public isActive = (): boolean => {
        return this.sidebarService.viewName === "info";
    }

    private openDownloadDialog = () => {
        this.dialog.open(DownloadDialogComponent);
    }
}

