import { Component, inject } from "@angular/core";
import { MatDialog, MAT_DIALOG_DATA } from "@angular/material/dialog";

import { ResourcesService } from "../../services/resources.service";

export type SendReportDialogData = {
    subject: string;
};

@Component({
    selector: "send-report",
    templateUrl: "./send-report-dialog.component.html"
})
export class SendReportDialogComponent {
    public mailToLink: string;

    public readonly resources = inject(ResourcesService);
    private readonly data = inject<SendReportDialogData>(MAT_DIALOG_DATA);

    constructor() {
        const body = encodeURIComponent(this.resources.reportAnIssueInstructions);
        const to = "israelhikingmap@gmail.com";
        const subject = encodeURIComponent(this.data.subject);
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
