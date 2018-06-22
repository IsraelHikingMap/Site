import { Injectable } from "@angular/core";
import { MatSnackBar } from "@angular/material";
import { ResourcesService } from "./resources.service";
import { ConfirmDialogComponent } from "../components/dialogs/confirm-dialog.component";

@Injectable()
export class ToastService {
    private duration: number;

    constructor(private resources: ResourcesService,
        private snackbar: MatSnackBar) {
        this.duration = 6000;
    }

    public error(message: string, title?: string) {
        this.snackbar.open(message, title, {
            direction: this.resources.direction,
            duration: this.duration,
            panelClass: ["mat-toolbar", "mat-warn"] // for some reason warn is red
        });
    }

    public warning(message: string, title?: string) {
        this.snackbar.open(message, title, {
            direction: this.resources.direction,
            duration: this.duration,
            panelClass: ["mat-toolbar", "mat-accent"] // for some reason accent is yellow
        });
    }

    public success(message: string, title?: string) {
        this.snackbar.open(message, title, {
            direction: this.resources.direction,
            duration: this.duration,
            panelClass: ["mat-toolbar", "mat-primary"]
        });
    }

    public info(message: string, title?: string) {
        this.snackbar.open(message, title, {
            direction: this.resources.direction,
            duration: this.duration
        });
    }

    public confirm(message: string, confirmAction: Function, declineAction: Function, isYesNo: boolean) {
        let componentRef = this.snackbar.openFromComponent(ConfirmDialogComponent);
        componentRef.instance.confirmMessage = message;
        componentRef.instance.confirmAction = () => {
            confirmAction();
            this.snackbar.dismiss();
        };
        componentRef.instance.declineAction = () => {
            declineAction();
            this.snackbar.dismiss();
        };
        componentRef.instance.confirmType = isYesNo ? "YesNo" : "OkCancel";
    }
}