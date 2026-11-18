import { inject, Service } from "@angular/core";
import { Router } from "@angular/router";

import { FileService } from "./file.service";
import { ResourcesService } from "./resources.service";
import { RouteStrings } from "./hash.service";
import { ToastService } from "./toast.service";

@Service()
export class DragAndDropService {

    private readonly resources = inject(ResourcesService);
    private readonly fileService = inject(FileService);
    private readonly toastService = inject(ToastService);
    private readonly router = inject(Router);

    public initialize() {
        if (typeof document === "undefined") {
            return;
        }
        document.addEventListener("dragover", (event) => {
            event.preventDefault();
        });
        document.addEventListener("drop", async (e: DragEvent) => {
            e.stopPropagation();
            e.preventDefault();
            // The data transfer is emptied once the handler returns, so it is read before navigating.
            const files = Array.prototype.slice.apply(e.dataTransfer.files) as File[];
            const url = files.length > 0 ? null : e.dataTransfer.getData("text");
            if (files.length === 0 && !url) {
                return;
            }
            this.router.navigate([RouteStrings.ROUTE_MAP]);
            // This is to let the route change to the map so that the relevant map will be used for fit bounds.
            await new Promise((resolve) => setTimeout(resolve, 100));
            if (url) {
                try {
                    await this.fileService.addRoutesFromUrl(url);
                } catch (ex) {
                    this.toastService.error(ex, this.resources.unableToLoadFromUrl + `: ${url}`);
                }
                return;
            }
            for (const file of files) {
                try {
                    await this.fileService.addRoutesFromFile(file);
                } catch (ex) {
                    this.toastService.error(ex, this.resources.unableToLoadFromFile + `: ${file.name}`);
                }
            }
        });
    }
}
