import { Component, Inject } from "@angular/core";
import { MAT_DIALOG_DATA, MatDialog } from "@angular/material/dialog";

import { BaseMapComponent } from "../base-map.component";
import { ResourcesService } from "../../services/resources.service";
import { PoiService, SimplePointType} from "../../services/poi.service";
import { ToastService } from "../../services/toast.service";
import { PrivatePoiUploaderService } from "../../services/private-poi-uploader.service";
import { LatLngAlt, LinkData } from "../../models/models";

export interface IAddSimplePoiDialogData {
    latlng: LatLngAlt;
    imageLink: LinkData;
    title: string;
    description: string;
    markerType: string;
}

@Component({
    selector: "add-simple-poi-doalog",
    templateUrl: "./add-simple-poi-dialog.component.html"
})
export class AddSimplePoiDialogComponent extends BaseMapComponent {
    private data: IAddSimplePoiDialogData;

    public static openDialog(matDialog: MatDialog, data: IAddSimplePoiDialogData) {
        matDialog.open(AddSimplePoiDialogComponent, { data });
    }

    constructor(resources: ResourcesService,
                private readonly poiService: PoiService,
                private readonly privatePoiUploaderService: PrivatePoiUploaderService,
                private readonly toastService: ToastService,
                @Inject(MAT_DIALOG_DATA) data: IAddSimplePoiDialogData) {
        super(resources);
        this.data = data;
    }

    public async addSimplePoint(pointType: SimplePointType) {
        try {
            await this.poiService.addSimplePoint(this.data.latlng, pointType);
            this.toastService.success(this.resources.dataUpdatedSuccessfully);
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
