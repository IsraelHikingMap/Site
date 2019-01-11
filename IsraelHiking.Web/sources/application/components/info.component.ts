import { Component } from "@angular/core";
import { MatDialog } from "@angular/material";
import { NgRedux, select } from "@angular-redux/store";
import { take } from "rxjs/operators";
import { Observable } from "rxjs";

import { BaseMapComponent } from "./base-map.component";
import { ResourcesService } from "../services/resources.service";
import { SidebarService } from "../services/sidebar.service";
import { HashService } from "../services/hash.service";
import { DownloadDialogComponent } from "./dialogs/download-dialog.component";
import { SetDownloadAction } from "../reducres/in-memory.reducer";
import { ApplicationState } from "../models/models";

@Component({
    selector: "info",
    templateUrl: "./info.component.html"
})
export class InfoComponent extends BaseMapComponent {

    @select((state: ApplicationState) => state.inMemoryState.download)
    public download$: Observable<boolean>;

    constructor(resources: ResourcesService,
        private readonly hashService: HashService,
        private readonly sidebarService: SidebarService,
        private readonly dialog: MatDialog,
        private readonly ngRedux: NgRedux<ApplicationState>) {
        super(resources);

        this.download$.subscribe((isOpenDownload) => {
            if (!isOpenDownload) {
                return;
            }
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
            this.ngRedux.dispatch(new SetDownloadAction({ download: false }));
        });
    }
}

