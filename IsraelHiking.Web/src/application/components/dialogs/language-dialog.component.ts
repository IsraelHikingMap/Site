import { Component } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { NgRedux } from "@angular-redux2/store";

import { BaseMapComponent } from "../base-map.component";
import { ResourcesService } from "../../services/resources.service";
import { ApplicationState, LanguageCode } from "../../models/models";

@Component({
    selector: "language-dialog",
    templateUrl: "./language-dialog.component.html"
})
export class LanguageDialogComponent extends BaseMapComponent {
    public selectedLanguageCode: LanguageCode;

    constructor(resources: ResourcesService,
                private readonly ngRedux: NgRedux<ApplicationState>) {
        super(resources);
        this.selectedLanguageCode = this.ngRedux.getState().configuration.language.code;
    }

    public static openDialog(dialog: MatDialog) {
        dialog.open(LanguageDialogComponent, {
            minWidth: "300px"
        });
    }

    public saveLanguage() {
        this.resources.setLanguage(this.selectedLanguageCode);
    }
}
