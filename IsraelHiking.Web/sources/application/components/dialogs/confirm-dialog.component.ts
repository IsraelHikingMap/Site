import { Component } from "@angular/core";

import { ResourcesService } from "../../services/resources.service";

type ConfirmType = "YesNo" | "OkCancel";

@Component({
    selector: "confirm-dialog",
    templateUrl: "confirm-dialog.component.html"
})
export class ConfirmDialogComponent {
    public confirmAction: () => void;
    public declineAction: () => void;
    public confirmMessage: string;
    public confirmType: ConfirmType;

    public constructor(public resources: ResourcesService) {
        this.confirmType = "YesNo";
        this.confirmAction = () => { throw new Error("Confirm action method must be provided!"); };
        this.declineAction = () => { throw new Error("Decline action method must be provided!"); };
    }

    public getConfirmButtonText() {
        switch (this.confirmType) {
            case "YesNo":
            default:
                return this.resources.yes;
            case "OkCancel":
                return this.resources.ok;
        }
    }

    public getDeclineButtonText() {
        switch (this.confirmType) {
            case "YesNo":
            default:
                return this.resources.no;
            case "OkCancel":
                return this.resources.cancel;
        }
    }
}
