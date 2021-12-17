import { Component } from "@angular/core";
import { MatDialog, MatDialogRef } from "@angular/material/dialog";
import { every } from "lodash-es";
import { NgRedux } from "@angular-redux2/store";

import { BaseMapComponent } from "../base-map.component";
import { ShareDialogComponent } from "./share-dialog.component";
import { DataContainerService } from "../../services/data-container.service";
import { DatabaseService } from "../../services/database.service";
import { FileService, FormatViewModel } from "../../services/file.service";
import { ResourcesService } from "../../services/resources.service";
import { ToastService } from "../../services/toast.service";
import { LoggingService } from "../../services/logging.service";
import { SetOfflineLastModifiedAction } from "../../reducers/offline.reducer";
import type { ApplicationState, DataContainer } from "../../models/models";

@Component({
    selector: "files-share-dialog",
    templateUrl: "./files-shares-dialog.component.html"
})
export class FilesSharesDialogComponent extends BaseMapComponent {

    public isSaveAsOpen: boolean;
    public formats: FormatViewModel[];

    constructor(resources: ResourcesService,
                private readonly dialog: MatDialog,
                private readonly matDialogRef: MatDialogRef<FilesSharesDialogComponent>,
                private readonly dataContainerService: DataContainerService,
                private readonly fileService: FileService,
                private readonly toastService: ToastService,
                private readonly databaseService: DatabaseService,
                private readonly loggingService: LoggingService,
                private readonly ngRedux: NgRedux<ApplicationState>) {
        super(resources);
        this.isSaveAsOpen = false;
        this.formats = this.fileService.formats;
    }

    public toggleSaveAs() {
        this.isSaveAsOpen = !this.isSaveAsOpen;
    }

    public async open(e: any) {
        let file = this.fileService.getFileFromEvent(e);
        if (!file) {
            return;
        }
        if (file.name.endsWith(".ihm") && this.ngRedux.getState().offlineState.isOfflineAvailable) {
            this.toastService.info(this.resources.openingAFilePleaseWait);
            try {
                await this.fileService.writeStyles(file);
                this.toastService.confirm({ type: "Ok", message: this.resources.finishedOpeningTheFile });
            } catch (ex) {
                this.toastService.error(ex, ex.message);
            }
            return;
        }
        if (file.name.endsWith(".mbtiles") && this.ngRedux.getState().offlineState.isOfflineAvailable) {
            this.toastService.info(this.resources.openingAFilePleaseWait);
            await this.databaseService.closeDatabase(file.name.replace(".mbtiles", ""));
            await this.fileService.saveToDatabasesFolder(file, file.name);
            this.toastService.confirm({ type: "Ok", message: this.resources.finishedOpeningTheFile });
            this.ngRedux.dispatch(new SetOfflineLastModifiedAction({ lastModifiedDate: new Date(file.lastModified) }));
            return;
        }
        try {
            await this.fileService.addRoutesFromFile(file);
            this.matDialogRef.close();
        } catch (ex) {
            this.toastService.error(ex, this.resources.unableToLoadFromFile);
        }
    }

    public async save() {
        let data = this.dataContainerService.getDataForFileExport();
        if (!this.isDataSaveable(data)) {
            this.toastService.error(new Error("Route data is empty"), this.resources.pleaseAddPointsToRoute);
            return;
        }
        try {
            await this.fileService.saveToFile(this.getName(data) + ".gpx", "gpx", data);
        } catch (ex) {
            this.toastService.error(ex, this.resources.unableToSaveToFile);
        }
    }

    public async saveAs(format: FormatViewModel) {
        let outputFormat = format.outputFormat;
        let data = this.dataContainerService.getDataForFileExport();
        if (outputFormat === "all_gpx_single_track") {
            outputFormat = "gpx_single_track";
            data = this.dataContainerService.getData();
        }
        if (!this.isDataSaveable(data)) {
            this.toastService.error(new Error("Route data is empty"), this.resources.pleaseAddPointsToRoute);
            return;
        }
        let name = this.getName(data);
        try {
            await this.fileService.saveToFile(`${name}.${format.extension}`, outputFormat, data);
        } catch (ex) {
            this.toastService.error(ex, this.resources.unableToSaveToFile);
        }
    }

    public openShare() {
        this.dialog.open(ShareDialogComponent);
    }

    private getName(data: DataContainer): string {
        let name = "IsraelHikingMap";
        if (data.routes.length === 1 && data.routes[0].name) {
            name = data.routes[0].name;
        }
        return name;
    }

    private isDataSaveable(data: DataContainer): boolean {
        if (data.routes.length === 0) {
            this.toastService.warning(this.resources.unableToSaveAnEmptyRoute);
            return false;
        }
        if (every(data.routes, r => r.segments.length === 0 && r.markers.length === 0)) {
            this.toastService.warning(this.resources.unableToSaveAnEmptyRoute);
            return false;
        }
        return true;
    }
}
