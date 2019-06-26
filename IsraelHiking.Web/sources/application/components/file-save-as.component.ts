import { Component, ViewEncapsulation, ViewChild } from "@angular/core";
import { MatSelect } from "@angular/material";
import { every } from "lodash";

import { DataContainerService } from "../services/data-container.service";
import { ResourcesService } from "../services/resources.service";
import { FileService, IFormatViewModel } from "../services/file.service";
import { ToastService } from "../services/toast.service";
import { BaseMapComponent } from "./base-map.component";
import { DataContainer } from "../models/models";

@Component({
    selector: "file-save-as",
    templateUrl: "./file-save-as.component.html",
    styleUrls: ["./file-save-as.component.scss"],
    encapsulation: ViewEncapsulation.None
})
export class FileSaveAsComponent extends BaseMapComponent {

    public isOpen: boolean;
    public formats: IFormatViewModel[];
    public selectedFormat: IFormatViewModel;

    @ViewChild("dropdown", { static: false })
    public dropdown: MatSelect;

    constructor(resources: ResourcesService,
                private readonly dataContainerService: DataContainerService,
                private readonly fileService: FileService,
                private readonly toastService: ToastService) {
        super(resources);

        this.isOpen = false;
        this.formats = this.fileService.formats;
        this.selectedFormat = this.formats[0];
    }

    public toggleSaveAs() {
        this.isOpen = !this.isOpen;
        if (this.isOpen) {
            setTimeout(() => this.dropdown.open(), 500);
        }
    }

    public saveAs = async (format: IFormatViewModel) => {
        this.selectedFormat = format;
        let outputFormat = format.outputFormat;
        let data = this.dataContainerService.getDataForFileExport();
        if (outputFormat === "all_gpx_single_track") {
            outputFormat = "gpx_single_track";
            data = this.dataContainerService.getData();
        }
        if (!this.isDataSaveable(data)) {
            return;
        }
        let name = this.getName(data);
        try {
            let showToast = await this.fileService.saveToFile(`${name}.${format.extension}`, outputFormat, data);
            if (showToast) {
                this.toastService.success(this.resources.fileSavedSuccessfully);
            }
        } catch (ex) {
            this.toastService.error(this.resources.unableToSaveToFile);
        }

        this.isOpen = false;
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
