import { Component } from "@angular/core";
import { BaseMarkerPopupComponent } from "./base-marker-popup.component";

@Component({
    selector: "poi-marker-popup",
    templateUrl: "./poi-marker-popup.component.html"
})
export class PoiMarkerPopupComponent extends BaseMarkerPopupComponent {
    public description: string;
    public thumbnail: string;
    public id: string;
    public address: string;
    private editMode: boolean = false;

    public isEditMode(): boolean {
        return this.editMode;
    }

    public setEditMode() {
        this.editMode = true;
    }

    public save() {
        this.editMode = false;
    }
}