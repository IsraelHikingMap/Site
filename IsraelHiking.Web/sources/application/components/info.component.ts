import { Component } from "@angular/core";
import { MatDialog } from "@angular/material";
import { take, filter } from "rxjs/operators";

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
        private readonly hashService: HashService,
        private readonly sidebarService: SidebarService,
        private readonly dialog: MatDialog) {
        super(resources);

        this.hashService.applicationStateChanged.pipe(filter(f => f.type === "download"))
            .subscribe(() => {
                if (!this.isActive()) {
                    this.sidebarService.toggle("info");
                }
                this.openDownloadDialog();
            });
    }

    public toggleInfo = () => {
        this.sidebarService.toggle("info");
    }

    public isActive = (): boolean => {
        return this.sidebarService.viewName === "info";
    }

    private openDownloadDialog = () => {
        let dialog = this.dialog.open(DownloadDialogComponent, { width: "600px" });
        dialog.afterClosed().pipe(take(1)).subscribe(() => {
            this.hashService.resetAddressbar();
        });
    }
}

