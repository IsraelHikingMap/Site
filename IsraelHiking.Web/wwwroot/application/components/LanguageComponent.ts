import { Component } from "@angular/core";
import { MdDialog } from "@angular/material";
import { ResourcesService, ILanguage } from "../services/ResourcesService";
import { BaseMapComponent } from "./BaseMapComponent";
import { LanguageDialogComponent } from "./dialogs/LanguageDialogComponent";

@Component({
    selector: "language",
    templateUrl: "application/components/language.html"
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