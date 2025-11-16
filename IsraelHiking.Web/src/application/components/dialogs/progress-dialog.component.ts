import { Component, inject } from "@angular/core";
import { Dir } from "@angular/cdk/bidi";
import { CdkScrollable } from "@angular/cdk/scrolling";
import { MatProgressBar } from "@angular/material/progress-bar";
import { DecimalPipe } from "@angular/common";
import { MatButton } from "@angular/material/button";
import { MatDialogRef, MatDialog, MAT_DIALOG_DATA, MatDialogContent, MatDialogActions, MatDialogClose } from "@angular/material/dialog";
import { Angulartics2OnModule } from "angulartics2";

import { ResourcesService } from "../../services/resources.service";
import { LoggingService } from "../../services/logging.service";

export type ProgressCallback = (value: number, text?: string) => void;

export interface IProgressDialogConfig {
    action: (progressCallback: ProgressCallback) => Promise<void>;
    showContinueButton: boolean;
    continueText: string;
}

@Component({
    selector: "progress-dialog",
    templateUrl: "progress-dialog.component.html",
    imports: [Dir, CdkScrollable, MatDialogContent, MatProgressBar, MatDialogActions, MatButton, MatDialogClose, Angulartics2OnModule, DecimalPipe]
})
export class ProgressDialogComponent {
    public progressPersentage: number = 0;
    public text: string = "";
    public isError: boolean;
    public isContinue: boolean;

    public continueAction: () => void;

    public readonly resources = inject(ResourcesService);

    private readonly matDialogRef = inject(MatDialogRef);
    private readonly loggingService: LoggingService = inject(LoggingService);
    private readonly data = inject<IProgressDialogConfig>(MAT_DIALOG_DATA);


    constructor() {
        this.isContinue = this.data.showContinueButton;
        const wrappedAction = () => {
            this.data.action((value, text = "") => {
                this.progressPersentage = value;
                this.text = text;
            }).then(
                () => this.matDialogRef.close(),
                (ex) => {
                    this.loggingService.error("Error in download dialog, " + ex.message);
                    this.text = ex.message;
                    this.isError = true;
                });
        };

        if (this.data.showContinueButton) {
            this.text = this.data.continueText;
            this.continueAction = () => {
                this.isContinue = false;
                wrappedAction();
            };
        } else {
            wrappedAction();
        }
    }

    public static openDialog(dialog: MatDialog, progressConfig: IProgressDialogConfig): MatDialogRef<ProgressDialogComponent> {
        return dialog.open(ProgressDialogComponent, {
            hasBackdrop: false,
            closeOnNavigation: false,
            disableClose: true,
            position: {
                top: "5px",
            },
            width: "80%",
            data: progressConfig
        });
    }
}
