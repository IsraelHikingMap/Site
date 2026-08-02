import { inject, Service } from "@angular/core";
import { MatSnackBar } from "@angular/material/snack-bar";
import { ResourcesService } from "./resources.service";
import { ConfirmDialogComponent, ConfirmType } from "../components/dialogs/confirm-dialog.component";
import { LoggingService } from "./logging.service";

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

@Service()
export class ToastService {
    private static readonly DURATION = 6000;

    private readonly resources = inject(ResourcesService);
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

    public undo(message: string, undoAction: () => void) {
        const snackbarRef = this.snackbar.open(message, this.resources.cancel, {
            direction: this.resources.direction,
            duration: ToastService.DURATION
        });
        snackbarRef.onAction().subscribe(() => {
            undoAction();
        });
    }

    public confirm(options: IConfirmOptions) {
        const componentRef = this.snackbar.openFromComponent(ConfirmDialogComponent, { panelClass: ["confirm-snackbar"]});
        componentRef.instance.confirmMessage.set(options.message);
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
        componentRef.instance.hasTwoButtons.set(options.type !== "Ok");
        switch (options.type) {
            case "Ok":
                componentRef.instance.confirmButtonText.set(this.resources.ok);
                break;
            case "YesNo":
                componentRef.instance.confirmButtonText.set(this.resources.yes);
                componentRef.instance.declineButtonText.set(this.resources.no);
                break;
            case "OkCancel":
                componentRef.instance.confirmButtonText.set(this.resources.ok);
                componentRef.instance.declineButtonText.set(this.resources.cancel);
                break;
            case "Custom":
                componentRef.instance.confirmButtonText.set(options.customConfirmText);
                componentRef.instance.declineButtonText.set(options.customDeclineText);
                break;
            default:
                throw new Error("Invalid confirm type!");
        }
        componentRef.instance.confirmIcon.set(options.confirmIcon);
        componentRef.instance.declineIcon.set(options.declineIcon);
    }
}
