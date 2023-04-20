import { Component, Inject } from "@angular/core";
import { MatLegacyDialog as MatDialog, MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA } from "@angular/material/legacy-dialog";

import { BaseMapComponent } from "../base-map.component";
import { ResourcesService } from "application/services/resources.service";

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
        let body = encodeURIComponent(this.resources.reportAnIssueInstructions);
        let to = "israelhikingmap@gmail.com";
        let subject = encodeURIComponent(data.subject);
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
