import { Component, inject } from "@angular/core";
import { Dir } from "@angular/cdk/bidi";
import { MatButton, MatAnchor } from "@angular/material/button";
import { CdkScrollable } from "@angular/cdk/scrolling";

import { MatHint } from "@angular/material/form-field";
import { MatDialog, MatDialogRef, MatDialogTitle, MatDialogClose, MatDialogContent } from "@angular/material/dialog";
import { Angulartics2OnModule } from "angulartics2";
import { every } from "lodash-es";
import { Store } from "@ngxs/store";

import { ShareDialogComponent } from "./share-dialog.component";
import { DataContainerService } from "../../services/data-container.service";
import { FileService, FormatViewModel } from "../../services/file.service";
import { ResourcesService } from "../../services/resources.service";
import { ToastService } from "../../services/toast.service";
import { LogReaderService } from "../../services/log-reader.service";
import { SetOfflineMapsLastModifiedDateAction } from "../../reducers/offline.reducer";
import type { DataContainer } from "../../models";

@Component({
    selector: "files-share-dialog",
    templateUrl: "./files-shares-dialog.component.html",
    imports: [Dir, MatDialogTitle, MatButton, MatDialogClose, CdkScrollable, MatDialogContent, Angulartics2OnModule, MatAnchor, MatHint]
})
export class FilesSharesDialogComponent {

    public isSaveAsOpen: boolean = false;
    public showHiddenWarning: boolean;
    public formats: FormatViewModel[];

    public readonly resources = inject(ResourcesService);

    private readonly dialog = inject(MatDialog);
    private readonly matDialogRef = inject(MatDialogRef);
    private readonly dataContainerService = inject(DataContainerService);
    private readonly fileService = inject(FileService);
    private readonly toastService = inject(ToastService);
    private readonly logReaderService = inject(LogReaderService);
    private readonly store = inject(Store);

    constructor() {
        this.formats = this.fileService.formats;
        this.showHiddenWarning = this.dataContainerService.hasHiddenRoutes();
    }

    public toggleSaveAs() {
        this.isSaveAsOpen = !this.isSaveAsOpen;
    }

    public async open(e: any) {
        const file = this.fileService.getFileFromEvent(e);
        if (!file) {
            return;
        }
        if (file.name.endsWith(".pmtiles")) {
            this.toastService.info(this.resources.openingAFilePleaseWait);
            await this.fileService.storeFileToCache(file.name, file);
            await this.fileService.moveFileFromCacheToDataDirectory(file.name);
            this.toastService.confirm({ type: "Ok", message: this.resources.finishedOpeningTheFile });
            this.store.dispatch(new SetOfflineMapsLastModifiedDateAction(new Date(file.lastModified)));
            return;
        }
        if (file.name.endsWith(".json")) {
            this.toastService.info(this.resources.openingAFilePleaseWait);
            await this.fileService.writeStyle(file.name, await this.fileService.getFileContent(file));
            this.toastService.confirm({ type: "Ok", message: this.resources.finishedOpeningTheFile });
            return;
        }
        if (file.name.endsWith(".txt") && file.name.includes("log")) {
            this.toastService.info(this.resources.openingAFilePleaseWait);
            const fileContent = await this.fileService.getFileContent(file);
            this.logReaderService.readLogFile(fileContent);
            this.matDialogRef.close();
            return;
        }
        try {
            await this.fileService.addRoutesFromFile(file);
            this.matDialogRef.close();
        } catch (ex) {
            this.toastService.error(ex as Error, this.resources.unableToLoadFromFile);
        }
    }

    public async save() {
        const data = this.dataContainerService.getDataForFileExport();
        if (!this.isDataSaveable(data)) {
            return;
        }
        try {
            await this.fileService.saveToFile(this.getName(data) + ".gpx", "gpx", data);
        } catch (ex) {
            this.toastService.error(ex as Error, this.resources.unableToSaveToFile);
        }
    }

    public async saveAs(format: FormatViewModel) {
        let outputFormat = format.outputFormat;
        let data = this.dataContainerService.getDataForFileExport();
        if (outputFormat === "all_gpx_single_track") {
            outputFormat = "gpx_single_track";
            data = this.dataContainerService.getData(false);
        }
        if (!this.isDataSaveable(data)) {
            return;
        }
        const name = this.getName(data);
        try {
            await this.fileService.saveToFile(`${name}.${format.extension}`, outputFormat, data);
        } catch (ex) {
            this.toastService.error(ex as Error, this.resources.unableToSaveToFile);
        }
    }

    public openShare() {
        this.dialog.open(ShareDialogComponent, { width: "480px" });
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
