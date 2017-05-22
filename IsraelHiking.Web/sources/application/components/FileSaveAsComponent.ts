import { Component, ViewEncapsulation } from "@angular/core";
import { MapService } from "../services/MapService";
import { LayersService } from "../services/layers/LayersService";
import { ResourcesService } from "../services/ResourcesService";
import { FileService } from "../services/FileService";
import { ToastService } from "../services/ToastService";
import { BaseMapComponent } from "./BaseMapComponent";
import * as _ from "lodash";
import * as Common from "../common/IsraelHiking";

export interface IFormatViewModel {
    label: string,
    outputFormat: string,
    extension: string,
}

@Component({
    selector: "file-save-as",
    templateUrl: "./fileSaveAs.html",
    styleUrls: ["./fileSaveAs.css"],
    encapsulation: ViewEncapsulation.None,
})
export class FileSaveAsComponent extends BaseMapComponent {

    public isOpen: boolean;
    public isFromatsDropdownOpen: boolean;
    public formats: IFormatViewModel[];
    public selectedFormat: IFormatViewModel;

    constructor(resources: ResourcesService,
        private mapService: MapService,
        private layersService: LayersService,
        private fileService: FileService,
        private toastService: ToastService,
        ) {
        super(resources);

        this.isOpen = false;
        this.isFromatsDropdownOpen = false;
        this.formats = [
            {
                label: "GPX version 1.1 (.gpx)",
                extension: "gpx",
                outputFormat: "gpx"
            } as IFormatViewModel, {
                label: "Keyhole Markup Language (.kml)",
                extension: "kml",
                outputFormat: "kml"
            } as IFormatViewModel, {
                label: "Naviguide binary route file (.twl)",
                extension: "twl",
                outputFormat: "twl"
            } as IFormatViewModel, {
                label: "Comma-Separated Values (.csv)",
                extension: "csv",
                outputFormat: "csv"
            } as IFormatViewModel, {
                label: "Single Track GPX (.gpx)",
                extension: "gpx",
                outputFormat: "gpx_single_track"
            } as IFormatViewModel, {
                label: "All routes to a single Track GPX (.gpx)",
                extension: "gpx",
                outputFormat: "all_gpx_single_track"
            } as IFormatViewModel
        ];

        this.selectedFormat = this.formats[0];  
    }


    public toggleSaveAs(e: Event) {
        this.isOpen = !this.isOpen;
        this.suppressEvents(e);
    };

    public saveAs = (format: IFormatViewModel, e: Event) => {
        this.selectedFormat = format;
        this.isFromatsDropdownOpen = false;
        let outputFormat = format.outputFormat;
        let data = this.getData();
        if (outputFormat === "all_gpx_single_track") {
            outputFormat = "gpx_single_track";
            data = this.layersService.getData();
        }
        if (!this.isDataSaveable(data)) {
            return;
        }
        let name = this.getName(data);
        this.fileService.saveToFile(`${name}.${format.extension}`, outputFormat, data)
            .then(() => { }, () => {
                this.toastService.error(this.resources.unableToSaveToFile);
            });

        this.isOpen = false;
        this.suppressEvents(e);
    }

    private getData(): Common.DataContainer {
        if (this.layersService.getSelectedRoute() == null) {
            return this.layersService.getData();
        }
        return {
            routes: [this.layersService.getSelectedRoute().getData()]
        } as Common.DataContainer;
    }

    private getName(data: Common.DataContainer): string {
        let name = "IsraelHikingMap";
        if (data.routes.length === 1 && data.routes[0].name) {
            name = data.routes[0].name;
        }
        return name;
    }

    private isDataSaveable(data: Common.DataContainer): boolean {
        if (data.routes.length === 0) {
            this.toastService.warning(this.resources.unableToSaveAnEmptyRoute);
            return false;
        }
        if (_.every(data.routes, r => r.segments.length === 0 && r.markers.length === 0)) {
            this.toastService.warning(this.resources.unableToSaveAnEmptyRoute);
            return false;
        }
        return true;
    }
}
