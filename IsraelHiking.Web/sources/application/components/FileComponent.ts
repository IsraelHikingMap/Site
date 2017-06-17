import { Component, HostListener } from "@angular/core";
import { MapService } from "../services/MapService";
import { LayersService } from "../services/layers/LayersService";
import { ResourcesService } from "../services/ResourcesService";
import { FileService } from "../services/FileService";
import { ToastService } from "../services/ToastService";
import { BaseMapComponent } from "./BaseMapComponent";
import * as _ from "lodash";
import * as Common from "../common/IsraelHiking";
import * as $ from "jquery";

@Component({
    selector: "file",
    templateUrl: "./file.html"
})
export class FileComponent extends BaseMapComponent {

    constructor(resources: ResourcesService,
        private mapService: MapService,
        private layersService: LayersService,
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
            this.layersService.setJsonData(dataContainer);
        }, () => {
            this.toastService.error(this.resources.unableToLoadFromFile);
        });
    }

    public save(e: Event) {
        let data = this.getData();
        if (!this.isDataSaveable(data)) {
            return;
        }
        this.fileService.saveToFile(this.getName(data) + ".gpx", "gpx", data)
            .then(() => { }, () => {
                this.toastService.error(this.resources.unableToSaveToFile);
            });
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

    public print(e: Event) {
        $(".leaflet-bar").each((i, a) => {
            $(a).addClass("no-print");
        });
        $(".mat-tooltip").each((i, a) => {
            $(a).addClass("no-print");
        });
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
                $("#openFile").click();
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
