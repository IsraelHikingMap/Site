import { Component, inject } from "@angular/core";
import { Dir } from "@angular/cdk/bidi";
import { MatButton, MatAnchor } from "@angular/material/button";
import { CdkScrollable } from "@angular/cdk/scrolling";
import { MatDialog, MAT_DIALOG_DATA, MatDialogTitle, MatDialogClose, MatDialogContent, MatDialogActions } from "@angular/material/dialog";

import { Angulartics2OnModule } from "../../directives/gtag.directive";
import { ResourcesService } from "../../services/resources.service";

export type SendReportDialogData = {
    subject: string;
};

@Component({
    selector: "send-report",
    templateUrl: "./send-report-dialog.component.html",
    imports: [Dir, MatDialogTitle, MatButton, MatDialogClose, CdkScrollable, MatDialogContent, MatDialogActions, MatAnchor, Angulartics2OnModule]
})
export class SendReportDialogComponent {
    public mailToLink: string;

    public readonly resources = inject(ResourcesService);
    private readonly data = inject<SendReportDialogData>(MAT_DIALOG_DATA);

    constructor() {
        const body = encodeURIComponent(this.resources.reportAnIssueInstructions);
        const to = "support@mapeak.com";
        const subject = encodeURIComponent(this.data.subject);
        this.mailToLink = `mailto:${to}?subject=${subject}&body=${body}`;
    }

    public static openDialog(dialog: MatDialog, subject: string) {
        dialog.open(SendReportDialogComponent,
            {
                maxWidth: "378px",
                data: {
                    subject
                } as SendReportDialogData
            });
    }
}
