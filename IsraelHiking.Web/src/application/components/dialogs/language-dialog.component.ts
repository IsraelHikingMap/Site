import { Component, inject } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { Store } from "@ngxs/store";

import { ResourcesService } from "../../services/resources.service";
import { AVAILABLE_LANGUAGES } from "../../reducers/initial-state";
import { ApplicationState, LanguageCode } from "../../models/models";

@Component({
    selector: "language-dialog",
    templateUrl: "./language-dialog.component.html"
})
export class LanguageDialogComponent {
    public selectedLanguageCode: LanguageCode;
    public availableLanguages = AVAILABLE_LANGUAGES;

    public readonly resources = inject(ResourcesService);

    private readonly store = inject(Store);

    constructor() {
        this.selectedLanguageCode = this.store.selectSnapshot((s: ApplicationState) => s.configuration).language.code;
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
