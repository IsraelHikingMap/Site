import { Component, inject } from "@angular/core";

import { ResourcesService } from "../../services/resources.service";

export type ConfirmType = "YesNo" | "OkCancel" | "Ok" | "Custom";

@Component({
    selector: "confirm-dialog",
    templateUrl: "confirm-dialog.component.html",
    standalone: false
})
export class ConfirmDialogComponent {
    public confirmAction: () => void;
    public declineAction: () => void;
    public hasTwoButtons: boolean;
    public confirmMessage: string;
    public confirmIcon: string;
    public confirmButtonText: string;
    public declineIcon: string;
    public declineButtonText: string;

    public readonly resources = inject(ResourcesService);

    public constructor() {
        this.confirmAction = () => { throw new Error("Confirm action method must be provided!"); };
        this.declineAction = () => { throw new Error("Decline action method must be provided!"); };
    }
}
