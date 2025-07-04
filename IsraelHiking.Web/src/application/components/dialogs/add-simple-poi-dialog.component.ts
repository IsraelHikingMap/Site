import { Component, inject } from "@angular/core";
import { Dir } from "@angular/cdk/bidi";
import { MatButton } from "@angular/material/button";
import { CdkScrollable } from "@angular/cdk/scrolling";
import { MAT_DIALOG_DATA, MatDialog, MatDialogTitle, MatDialogClose, MatDialogContent } from "@angular/material/dialog";
import { Angulartics2OnModule } from "angulartics2";

import { ResourcesService } from "../../services/resources.service";
import { PoiService, SimplePointType} from "../../services/poi.service";
import { ToastService } from "../../services/toast.service";
import { PrivatePoiUploaderService } from "../../services/private-poi-uploader.service";
import type { LatLngAlt, LinkData } from "../../models/models";

export type AddSimplePoiDialogData = {
    latlng: LatLngAlt;
    imageLink: LinkData;
    title: string;
    description: string;
    markerType: string;
};

@Component({
    selector: "add-simple-poi-doalog",
    templateUrl: "./add-simple-poi-dialog.component.html",
    imports: [Dir, MatDialogTitle, MatButton, MatDialogClose, CdkScrollable, MatDialogContent, Angulartics2OnModule]
})
export class AddSimplePoiDialogComponent {

    public readonly resources = inject(ResourcesService);

    private readonly poiService = inject(PoiService);
    private readonly privatePoiUploaderService = inject(PrivatePoiUploaderService);
    private readonly toastService = inject(ToastService);
    private readonly data = inject<AddSimplePoiDialogData>(MAT_DIALOG_DATA);

    public static openDialog(dialog: MatDialog, data: AddSimplePoiDialogData) {
        dialog.open(AddSimplePoiDialogComponent, { data });
    }

    public async addSimplePoint(pointType: SimplePointType) {
        try {
            await this.poiService.addSimplePoint(this.data.latlng, pointType);
            this.toastService.success(this.resources.dataUpdatedSuccessfullyItWillTakeTimeToSeeIt);
        } catch (ex) {
            this.toastService.error(ex, this.resources.unableToSaveData);
        }
    }

    public async addComplexPoint() {
        await this.privatePoiUploaderService.uploadPoint(
            this.data.latlng,
            this.data.imageLink,
            this.data.title,
            this.data.description,
            this.data.markerType);
    }
}
