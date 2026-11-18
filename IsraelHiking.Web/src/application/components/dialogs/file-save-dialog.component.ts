import { Component, inject } from "@angular/core";
import { Dir } from "@angular/cdk/bidi";
import { MatButton, MatAnchor , MatIconButton } from "@angular/material/button";
import { MatDivider } from "@angular/material/divider";
import { CdkScrollable } from "@angular/cdk/scrolling";
import { MatDialogTitle, MatDialogClose, MatDialogContent, MAT_DIALOG_DATA } from "@angular/material/dialog";

import { AnalyticsDirective } from "../../directives/analytics.directive";
import { DeviceProviderLogoComponent } from "../device-provider-logo.component";
import { FileService, FormatViewModel } from "../../services/file.service";
import { ResourcesService } from "../../services/resources.service";
import { ToastService } from "../../services/toast.service";
import { DeviceProvidersService } from "../../services/device-providers/device-providers.service";
import type { DataContainer, DeviceProviderId, RouteData } from "../../models";

@Component({
    selector: "file-save-dialog",
    templateUrl: "./file-save-dialog.component.html",
    imports: [MatIconButton, Dir, MatDialogTitle, MatButton, MatDialogClose, CdkScrollable, MatDialogContent, AnalyticsDirective, MatAnchor, MatDivider, DeviceProviderLogoComponent]
})
export class FileSaveDialogComponent {
    public readonly resources = inject(ResourcesService);

    private readonly fileService = inject(FileService);
    private readonly toastService = inject(ToastService);
    private readonly deviceProvidersService = inject(DeviceProvidersService);
    private readonly data = inject<RouteData>(MAT_DIALOG_DATA)

    public readonly formats: FormatViewModel[] = this.fileService.formats;
    public readonly deviceProviders = this.deviceProvidersService.availableProviders;

    public async saveAs(format: FormatViewModel) {
        const outputFormat = format.outputFormat;
        const data = {
            routes: [this.data]
        } as DataContainer;
        try {
            await this.fileService.saveToFile(`${this.getName(data)}.${format.extension}`, outputFormat, data);
        } catch (ex) {
            this.toastService.error(ex as Error, this.resources.unableToExport);
        }
    }

    public async sendToDevice(id: DeviceProviderId) {
        await this.deviceProvidersService.sendRouteGated(id, [this.data]);
    }

    private getName(data: DataContainer): string {
        let name = "Mapeak";
        if (data.routes.length === 1 && data.routes[0].name) {
            name = data.routes[0].name;
        }
        return name;
    }
}