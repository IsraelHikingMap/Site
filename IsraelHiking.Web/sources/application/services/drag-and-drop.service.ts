import { Injectable } from "@angular/core";
import { FileService } from "./file.service";
import { ResourcesService } from "./resources.service";
import { MapService } from "./map.service";
import { ToastService } from "./toast.service";
import { DataContainerService } from "./data-container.service";
import * as $ from "jquery";

@Injectable()
export class DragAndDropService  {

    constructor(private resourcesService: ResourcesService,
        private mapService: MapService,
        private fileService: FileService,
        private dataContainerService: DataContainerService,
        private toastService: ToastService) {

        var dropbox = $(this.mapService.map.getContainer());

        dropbox.on("dragenter", () => { this.mapService.map.scrollWheelZoom.disable(); });
        dropbox.on("dragleave", () => { this.mapService.map.scrollWheelZoom.enable(); });
        dropbox.on("dragover", (e: JQueryEventObject) => {
            e.stopPropagation();
            e.preventDefault();
        });
        dropbox.on("drop", (e: JQueryEventObject) => {
            e.stopPropagation();
            e.preventDefault();
            this.mapService.map.scrollWheelZoom.enable();
            let transferData = (e.originalEvent as DragEvent).dataTransfer;
            let files = Array.prototype.slice.apply(transferData.files) as File[];
            if (files && files.length > 0) {
                setTimeout(() => {
                    for (let file of files) {
                        fileService.openFromFile(file).then((dataContainer) => {
                            dataContainerService.setData(dataContainer);
                        }, () => {
                            toastService.error(resourcesService.unableToLoadFromFile + `: ${file.name}`);
                        });
                    }
                }, 25);
                return;
            }

            let url = transferData.getData("text");
            if (url) {
                fileService.openFromUrl(url).then((dataContainer) => {
                    dataContainerService.setData(dataContainer.json());
                }, () => {
                    toastService.error(resourcesService.unableToLoadFromUrl + `: ${url}`);
                });
            }
        });
    }
}
