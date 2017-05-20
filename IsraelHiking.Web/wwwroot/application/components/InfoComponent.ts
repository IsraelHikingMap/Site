import { Component } from "@angular/core";
import { MdDialog } from "@angular/material";
import { BaseMapComponent } from "./BaseMapComponent";
import { ResourcesService } from "../services/ResourcesService";
import { SidebarService } from "../services/SidebarService";
import { HashService } from "../services/HashService";
import { DownloadDialogComponent } from "./dialogs/DownloadDialogComponent";

@Component({
    selector: "info",
    moduleId: module.id,
    templateUrl: "info.html"
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

