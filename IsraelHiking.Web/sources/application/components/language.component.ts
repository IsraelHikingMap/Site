import { Component } from "@angular/core";
import { MdDialog } from "@angular/material";
import { ResourcesService } from "../services/resources.service";
import { BaseMapComponent } from "./base-map.component";
import { LanguageDialogComponent } from "./dialogs/language-dialog.component";

@Component({
    selector: "language",
    templateUrl: "./language.component.html"
})
export class LanguageComponent extends BaseMapComponent {
    constructor(resources: ResourcesService,
        private dialog: MdDialog) {
        super(resources);
    }

    public openDialog(e: Event) {
        this.dialog.open(LanguageDialogComponent);
        this.suppressEvents(e);
    }
}