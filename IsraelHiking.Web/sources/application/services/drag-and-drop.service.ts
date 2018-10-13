import { Injectable } from "@angular/core";
import { FileService } from "./file.service";
import { ResourcesService } from "./resources.service";
import { ToastService } from "./toast.service";
import { DataContainerService } from "./data-container.service";

@Injectable()
export class DragAndDropService {

    constructor(private readonly resourcesService: ResourcesService,
        private readonly fileService: FileService,
        private readonly dataContainerService: DataContainerService,
        private readonly toastService: ToastService) {

        // HM TODO: make drag and drop work on the map
        let dropbox = window.document;// this.mapService.map.getContainer();
        dropbox.addEventListener("drop", (e: DragEvent) => {
            e.stopPropagation();
            e.preventDefault();
            let files = Array.prototype.slice.apply(e.dataTransfer.files) as File[];
            if (files && files.length > 0) {
                setTimeout(async () => {
                    for (let file of files) {
                        try {
                            let dataContainer = await this.fileService.openFromFile(file);
                            this.dataContainerService.setData(dataContainer);
                        } catch (ex) {
                            this.toastService.error(this.resourcesService.unableToLoadFromFile + `: ${file.name}`);
                        }
                    }
                }, 25);
                return;
            }

            let url = e.dataTransfer.getData("text");
            if (url) {
                this.fileService.openFromUrl(url).then((dataContainer) => {
                    this.dataContainerService.setData(dataContainer);
                }, () => {
                    this.toastService.error(resourcesService.unableToLoadFromUrl + `: ${url}`);
                });
            }
        });
    }
}
