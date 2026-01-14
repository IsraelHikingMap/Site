import { Component, inject } from "@angular/core";
import { Dir } from "@angular/cdk/bidi";
import { MatButton, MatAnchor } from "@angular/material/button";
import { CdkScrollable } from "@angular/cdk/scrolling";
import { MatDialogTitle, MatDialogClose, MatDialogContent, MAT_DIALOG_DATA } from "@angular/material/dialog";

import { Angulartics2OnModule } from "../../directives/gtag.directive";
import { FileService, FormatViewModel } from "../../services/file.service";
import { ResourcesService } from "../../services/resources.service";
import { ToastService } from "../../services/toast.service";
import type { DataContainer, RouteData } from "../../models";

@Component({
    selector: "file-save-dialog",
    templateUrl: "./file-save-dialog.component.html",
    imports: [Dir, MatDialogTitle, MatButton, MatDialogClose, CdkScrollable, MatDialogContent, Angulartics2OnModule, MatAnchor]
})
export class FileSaveDialogComponent {
    public readonly resources = inject(ResourcesService);

    private readonly fileService = inject(FileService);
    private readonly toastService = inject(ToastService);
    private data = inject<RouteData>(MAT_DIALOG_DATA)

    public formats: FormatViewModel[] = this.fileService.formats;

    public async saveAs(format: FormatViewModel) {
        const outputFormat = format.outputFormat;
        const data = {
            routes: [this.data]
        } as DataContainer;
        try {
            await this.fileService.saveToFile(`${this.getName(data)}.${format.extension}`, outputFormat, data);
        } catch (ex) {
            this.toastService.error(ex as Error, this.resources.unableToSaveToFile);
        }
    }

    private getName(data: DataContainer): string {
        let name = "Mapeak";
        if (data.routes.length === 1 && data.routes[0].name) {
            name = data.routes[0].name;
        }
        return name;
    }
}