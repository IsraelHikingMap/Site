import { Component, inject, signal } from "@angular/core";
import { Dir } from "@angular/cdk/bidi";
import { MatButton , MatIconButton } from "@angular/material/button";
import { CdkScrollable } from "@angular/cdk/scrolling";
import { MatRadioGroup, MatRadioButton } from "@angular/material/radio";
import { FormsModule } from "@angular/forms";
import { AnimationOptions, LottieComponent } from "ngx-lottie";
import { MatTooltip } from "@angular/material/tooltip";
import { MatDialog, MatDialogTitle, MatDialogClose, MatDialogContent, MatDialogActions } from "@angular/material/dialog";
import { Store } from "@ngxs/store";

import { AnalyticsDirective } from "../../directives/analytics.directive";
import { ResourcesService } from "../../services/resources.service";
import { AVAILABLE_LANGUAGES } from "../../reducers/initial-state";
import { ApplicationState, LanguageCode } from "../../models";

@Component({
    selector: "language-dialog",
    templateUrl: "./language-dialog.component.html",
    imports: [MatIconButton, Dir, MatDialogTitle, MatButton, MatDialogClose, CdkScrollable, MatDialogContent, MatRadioGroup, FormsModule, MatRadioButton, AnalyticsDirective, MatDialogActions, MatTooltip, LottieComponent]
})
export class LanguageDialogComponent {
    public readonly selectedLanguageCode = signal<LanguageCode>(null);
    public readonly availableLanguages = AVAILABLE_LANGUAGES;
    readonly lottieLanguage: AnimationOptions = { path: "content/lottie/dialog-language.json" };

    public readonly resources = inject(ResourcesService);

    private readonly store = inject(Store);

    constructor() {
        this.selectedLanguageCode.set(this.store.selectSnapshot((s: ApplicationState) => s.configuration).language.code);
    }

    public static openDialog(dialog: MatDialog) {
        dialog.open(LanguageDialogComponent, {
            minWidth: "300px"
        });
    }

    public saveLanguage() {
        this.resources.setLanguage(this.selectedLanguageCode());
    }
}
