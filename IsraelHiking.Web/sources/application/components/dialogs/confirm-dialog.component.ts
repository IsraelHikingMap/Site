import { Component } from "@angular/core";

import { ResourcesService } from "../../services/resources.service";

export type ConfirmType = "YesNo" | "OkCancel" | "Ok" | "Custom";

@Component({
    selector: "confirm-dialog",
    templateUrl: "confirm-dialog.component.html"
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

    public constructor(public resources: ResourcesService) {
        this.confirmAction = () => { throw new Error("Confirm action method must be provided!"); };
        this.declineAction = () => { throw new Error("Decline action method must be provided!"); };
    }
}
