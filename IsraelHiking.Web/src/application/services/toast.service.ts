import { inject, Injectable } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { MatSnackBar } from "@angular/material/snack-bar";
import { ResourcesService } from "./resources.service";
import { ConfirmDialogComponent, ConfirmType } from "../components/dialogs/confirm-dialog.component";
import { ProgressDialogComponent, IProgressDialogConfig } from "../components/dialogs/progress-dialog.component";
import { LoggingService } from "./logging.service";
import { firstValueFrom } from "rxjs";

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
    private static readonly DURATION = 6000;

    private readonly resources = inject(ResourcesService);
    private readonly matDialog = inject(MatDialog);
    private readonly snackbar = inject(MatSnackBar);
    private readonly loggingService = inject(LoggingService);

    public error(ex: Error | unknown, message: string, title?: string) {
        this.loggingService.error(message + ": " + (ex as Error).message);
        this.snackbar.open(message, title, {
            direction: this.resources.direction,
            duration: ToastService.DURATION,
            panelClass: ["error-snackbar"]
        });

    }

    public warning(message: string, title?: string) {
        this.snackbar.open(message, title, {
            direction: this.resources.direction,
            duration: ToastService.DURATION,
            panelClass: ["warn-snackbar"]
        });
    }

    public success(message: string, title?: string) {
        this.snackbar.open(message, title, {
            direction: this.resources.direction,
            duration: ToastService.DURATION,
            panelClass: ["success-snackbar"]
        });
    }

    public info(message: string, title?: string) {
        this.snackbar.open(message, title, {
            direction: this.resources.direction,
            duration: ToastService.DURATION
        });
    }

    public undo(message: string, undoAction: () => void, cleanupAction: () => void) {
        let undoWasPerformed = false;
        const snackbarRef = this.snackbar.open(message, this.resources.cancel, {
            direction: this.resources.direction,
            duration: ToastService.DURATION
        });
        snackbarRef.onAction().subscribe(() => {
            undoAction();
            undoWasPerformed = true;
            this.snackbar.dismiss();
        });
        snackbarRef.afterDismissed().subscribe(() => {
            if (!undoWasPerformed) {
                cleanupAction();
            }
        });
    }

    public confirm(options: IConfirmOptions) {
        const componentRef = this.snackbar.openFromComponent(ConfirmDialogComponent, { panelClass: ["confirm-snackbar"]});
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

    public progress(config: IProgressDialogConfig): Promise<any> {
        const dialogRef = ProgressDialogComponent.openDialog(this.matDialog, config);
        return firstValueFrom(dialogRef.afterClosed());
    }
}
