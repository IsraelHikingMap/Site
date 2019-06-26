import { Injectable } from "@angular/core";
import { MatSnackBar } from "@angular/material";
import { ResourcesService } from "./resources.service";
import { ConfirmDialogComponent, ConfirmType } from "../components/dialogs/confirm-dialog.component";

export interface IConfirmOptions {
    message: string;
    type: ConfirmType;
    confirmAction?: () => void;
    declineAction?: () => void;
    customConfirmText?: string;
    customDeclineText?: string;
    confirmIcon?: string;
    declineIcon?: string;
}

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

    public confirm(options: IConfirmOptions) {

        let componentRef = this.snackbar.openFromComponent(ConfirmDialogComponent);
        componentRef.instance.confirmMessage = options.message;
        componentRef.instance.confirmAction = () => {
            if (options.confirmAction != null) {
                options.confirmAction();
            }
            this.snackbar.dismiss();
        };
        componentRef.instance.declineAction = () => {
            if (options.declineAction != null) {
                options.declineAction();
            }
            this.snackbar.dismiss();
        };
        componentRef.instance.hasTwoButtons = options.type !== "Ok";
        switch (options.type) {
            case "Ok":
                componentRef.instance.confirmButtonText = this.resources.ok;
                break;
            case "YesNo":
                componentRef.instance.confirmButtonText = this.resources.yes;
                componentRef.instance.declineButtonText = this.resources.no;
                break;
            case "OkCancel":
                componentRef.instance.confirmButtonText = this.resources.ok;
                componentRef.instance.declineButtonText = this.resources.cancel;
                break;
            case "Custom":
                componentRef.instance.confirmButtonText = options.customConfirmText;
                componentRef.instance.declineButtonText = options.customDeclineText;
                break;
            default:
                throw new Error("Invalid confirm type!");
        }
        componentRef.instance.confirmIcon = options.confirmIcon;
        componentRef.instance.declineIcon = options.declineIcon;
    }
}
