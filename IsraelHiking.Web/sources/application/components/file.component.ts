import { Component, HostListener, ViewChild, ElementRef } from "@angular/core";
import * as L from "leaflet";
import * as _ from "lodash";

import { MapService } from "../services/map.service";
import { DataContainerService } from "../services/data-container.service";
import { ResourcesService } from "../services/resources.service";
import { FileService } from "../services/file.service";
import { ToastService } from "../services/toast.service";
import { BaseMapComponent } from "./base-map.component";
import * as Common from "../common/IsraelHiking";

@Component({
    selector: "file",
    templateUrl: "./file.component.html"
})
export class FileComponent extends BaseMapComponent {

    @ViewChild("openFile")
    public openFileElement: ElementRef;

    constructor(resources: ResourcesService,
        private readonly mapService: MapService,
        private readonly dataContainerService: DataContainerService,
        private readonly fileService: FileService,
        private readonly toastService: ToastService,
    ) {
        super(resources);
    }

    public async open(e: any) {
        let file = this.fileService.getFileFromEvent(e);
        if (!file) {
            return;
        }
        try {
            let dataContainer = await this.fileService.openFromFile(file);
            this.dataContainerService.setData(dataContainer);
        } catch (ex) {
            this.toastService.error(this.resources.unableToLoadFromFile);
        }
    }

    public async save(e: Event) {
        let data = this.dataContainerService.getDataForFileExport();
        if (!this.isDataSaveable(data)) {
            return;
        }
        this.suppressEvents(e);
        try {
            await this.fileService.saveToFile(this.getName(data) + ".gpx", "gpx", data);
            this.toastService.success(this.resources.fileSavedSuccessfully);
        } catch (ex) {
            this.toastService.error(this.resources.unableToSaveToFile);
        }
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

    public print(e: Event) {
        window.print();
        this.suppressEvents(e);
    }

    public showPrint(): boolean {
        return !L.Browser.mobile;
    }

    @HostListener("window:keydown", ["$event"])
    public onFileShortcutKeys($event: KeyboardEvent) {
        if ($event.ctrlKey === false) {
            return true;
        }
        switch (String.fromCharCode($event.which).toLowerCase()) {
            case "o":
                // this doesn't work on firefox due to security reasons. it does work in chrome and IE though.
                this.openFileElement.nativeElement.click();
                break;
            case "s":
                this.save($event);
                break;
            case "p":
                this.print($event);
                break;
            default:
                return true;
        }
        return true;
    }
}
