import { Injectable } from "@angular/core";

import { FileService } from "./file.service";
import { ResourcesService } from "./resources.service";
import { ToastService } from "./toast.service";
import { LoggingService } from './logging.service';

@Injectable()
export class DragAndDropService {

    constructor(private readonly resources: ResourcesService,
                private readonly fileService: FileService,
                private readonly toastService: ToastService,
                private readonly loggingService: LoggingService
        ) { }

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
                            this.loggingService.error("Unable to drag-and-drop file: " + ex.toString())
                            this.toastService.error(this.resources.unableToLoadFromFile + `: ${file.name}`);
                        }
                    }
                }, 25);
                return;
            }

            let url = e.dataTransfer.getData("text");
            if (url) {
                this.fileService.addRoutesFromUrl(url).then(() => { }, () => {
                    this.toastService.error(this.resources.unableToLoadFromUrl + `: ${url}`);
                });
            }
        });
    }
}
