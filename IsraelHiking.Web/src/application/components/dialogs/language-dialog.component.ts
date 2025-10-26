import { Component, inject } from "@angular/core";
import { Dir } from "@angular/cdk/bidi";
import { MatButton } from "@angular/material/button";
import { CdkScrollable } from "@angular/cdk/scrolling";
import { MatRadioGroup, MatRadioButton } from "@angular/material/radio";
import { FormsModule } from "@angular/forms";

import { MatTooltip } from "@angular/material/tooltip";
import { MatDialog, MatDialogTitle, MatDialogClose, MatDialogContent, MatDialogActions } from "@angular/material/dialog";
import { Angulartics2OnModule } from "angulartics2";
import { Store } from "@ngxs/store";

import { ResourcesService } from "../../services/resources.service";
import { AVAILABLE_LANGUAGES } from "../../reducers/initial-state";
import { ApplicationState, LanguageCode } from "../../models";

@Component({
    selector: "language-dialog",
    templateUrl: "./language-dialog.component.html",
    imports: [Dir, MatDialogTitle, MatButton, MatDialogClose, CdkScrollable, MatDialogContent, MatRadioGroup, FormsModule, MatRadioButton, Angulartics2OnModule, MatDialogActions, MatTooltip]
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
