import { Component, Inject } from "@angular/core";
import { MatDialog, MAT_DIALOG_DATA } from "@angular/material/dialog";

import { BaseMapComponent } from "../base-map.component";
import { ResourcesService } from "../../services/resources.service";

export type SendReportDialogData = {
    subject: string;
};

@Component({
    selector: "send-report",
    templateUrl: "./send-report-dialog.component.html"
})
export class SendReportDialogComponent extends BaseMapComponent {
    public mailToLink: string;

    constructor(resources: ResourcesService,
        @Inject(MAT_DIALOG_DATA) data: SendReportDialogData) {
        super(resources);
        const body = encodeURIComponent(this.resources.reportAnIssueInstructions);
        const to = "israelhikingmap@gmail.com";
        const subject = encodeURIComponent(data.subject);
        this.mailToLink = `mailto:${to}?subject=${subject}&body=${body}`;
    }

    public static openDialog(matDialog: MatDialog, subject: string) {
        matDialog.open(SendReportDialogComponent,
            {
                maxWidth: "378px",
                data: {
                    subject
                } as SendReportDialogData
            });
    }
}
