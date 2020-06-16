import { Component, Inject } from "@angular/core";
import { MatDialogRef, MatDialog, MAT_DIALOG_DATA } from "@angular/material";

import { BaseMapComponent } from "../base-map.component";
import { ResourcesService } from "../../services/resources.service";

export type ProgressCallback = (value: number, text?: string) => void;

export interface IProgressDialogConfig {
    action: (progressCallback: ProgressCallback) => Promise<void>;
    showContinueButton: boolean;
    continueText: string;
}

@Component({
    selector: "progress-dialog",
    templateUrl: "progress-dialog.component.html"
})
export class ProgressDialogComponent extends BaseMapComponent {
    public progressPersentage: number;
    public text: string;
    public isError: boolean;
    public isContinue: boolean;

    public continueAction: () => void;

    constructor(resources: ResourcesService,
                private readonly matDialogRef: MatDialogRef<ProgressDialogComponent>,
                @Inject(MAT_DIALOG_DATA) data: IProgressDialogConfig
    ) {
        super(resources);
        this.progressPersentage = 0;
        this.text = "";
        this.isContinue = data.showContinueButton;
        let wrappedAction = () => {
            data.action((value, text) => {
                this.progressPersentage = value;
                this.text = text;
            }).then(
                () => this.matDialogRef.close(),
                (ex) => {
                    this.text = ex.message;
                    this.isError = true;
                });
        };

        if (data.showContinueButton) {
            this.text = data.continueText;
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
