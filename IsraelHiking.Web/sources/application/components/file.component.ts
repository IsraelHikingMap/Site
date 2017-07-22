import { Component, HostListener, ViewChild, ElementRef } from "@angular/core";
import { MapService } from "../services/map.service";
import { DataContainerService } from "../services/data-container.service";
import { ResourcesService } from "../services/resources.service";
import { FileService } from "../services/file.service";
import { ToastService } from "../services/toast.service";
import { BaseMapComponent } from "./base-map.component";
import * as _ from "lodash";
import * as Common from "../common/IsraelHiking";

@Component({
    selector: "file",
    templateUrl: "./file.component.html"
})
export class FileComponent extends BaseMapComponent {

    @ViewChild("openFile") openFileElement: ElementRef;
    
    constructor(resources: ResourcesService,
        private mapService: MapService,
        private dataContainerService: DataContainerService,
        private fileService: FileService,
        private toastService: ToastService,
        ) {
        super(resources);
    }

    public open(e: any) {
        let file = e.dataTransfer ? e.dataTransfer.files[0] : e.target.files[0];
        if (!file) {
            return;
        }
        this.fileService.openFromFile(file).then((dataContainer: Common.DataContainer) => {
            this.dataContainerService.setData(dataContainer);
        }, () => {
            this.toastService.error(this.resources.unableToLoadFromFile);
        });
    }

    public save(e: Event) {
        let data = this.dataContainerService.getDataForFileExport();
        if (!this.isDataSaveable(data)) {
            return;
        }
        this.fileService.saveToFile(this.getName(data) + ".gpx", "gpx", data)
            .then(() => { }, () => {
                this.toastService.error(this.resources.unableToSaveToFile);
            });
        this.suppressEvents(e);
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
            default:
                return true;
        }
        return true;
    }
}
