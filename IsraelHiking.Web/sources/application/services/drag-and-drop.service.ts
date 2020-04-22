import { Injectable } from "@angular/core";

import { FileService } from "./file.service";
import { ResourcesService } from "./resources.service";
import { ToastService } from "./toast.service";

@Injectable()
export class DragAndDropService {

    constructor(private readonly resourcesService: ResourcesService,
                private readonly fileService: FileService,
                private readonly toastService: ToastService) { }

    public initialize() {
        document.addEventListener("dragover", (event) => {
            event.preventDefault();
        });
        document.addEventListener("drop", (e: DragEvent) => {
            e.stopPropagation();
            e.preventDefault();
            let files = Array.prototype.slice.apply(e.dataTransfer.files) as File[];
            if (files && files.length > 0) {
                setTimeout(async () => {
                    for (let file of files) {
                        try {
                            await this.fileService.addRoutesFromFile(file);
                        } catch (ex) {
                            this.toastService.error(this.resourcesService.unableToLoadFromFile + `: ${file.name}`);
                        }
                    }
                }, 25);
                return;
            }

            let url = e.dataTransfer.getData("text");
            if (url) {
                this.fileService.addRoutesFromUrl(url).then(() => { }, () => {
                    this.toastService.error(resourcesService.unableToLoadFromUrl + `: ${url}`);
                });
            }
        });
    }
}
