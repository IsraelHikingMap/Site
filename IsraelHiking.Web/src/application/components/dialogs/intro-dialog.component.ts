import { Component, inject } from "@angular/core";
import { Dir } from "@angular/cdk/bidi";
import { CdkScrollable } from "@angular/cdk/scrolling";

import { MatRadioGroup, MatRadioButton } from "@angular/material/radio";
import { MatButton } from "@angular/material/button";
import { MatDialog, MatDialogConfig, MatDialogRef, MatDialogContent, MatDialogActions } from "@angular/material/dialog";
import { AnimationOptions, LottieComponent } from "ngx-lottie";
import { Store } from "@ngxs/store";

import { Angulartics2OnModule } from "../../directives/gtag.directive";
import { ResourcesService } from "../../services/resources.service";
import { StopShowingIntroAction } from "../../reducers/configuration.reducer";
import { AVAILABLE_LANGUAGES } from "../../reducers/initial-state";
import { RunningContextService } from "../../services/running-context.service";
import languageAnimationData from "../../../content/lottie/dialog-language.json";
import mapsAnimationData from "../../../content/lottie/dialog-maps.json";
import planAnimationData from "../../../content/lottie/dialog-plan.json";
import moreAnimationData from "../../../content/lottie/dialog-more.json";

@Component({
    selector: "intro-dialog",
    templateUrl: "./intro-dialog.component.html",
    styleUrls: ["./intro-dialog.component.scss"],
    imports: [Dir, CdkScrollable, MatDialogContent, MatRadioGroup, MatRadioButton, Angulartics2OnModule, LottieComponent, MatDialogActions, MatButton]
})
export class IntroDialogComponent {

    lottieLanguage: AnimationOptions = { animationData: languageAnimationData };
    lottieMaps: AnimationOptions = { animationData: mapsAnimationData };
    lottiePlan: AnimationOptions = { animationData: planAnimationData };
    lottieMore: AnimationOptions = { animationData: moreAnimationData };

    public step: number = 0;
    public availableLanguages = AVAILABLE_LANGUAGES;

    public readonly resources = inject(ResourcesService);

    private readonly dialogRef = inject(MatDialogRef);
    private readonly store = inject(Store);

    public static openDialog(dialog: MatDialog, runningContextSerivce: RunningContextService) {
        const options: MatDialogConfig = {};
        if (runningContextSerivce.isMobile) {
            options.maxWidth = "100vw";
            options.width = "100vw";
            options.maxHeight = "100vh";
            options.height = "100vh";
            options.position = {
                bottom: "0px",
                top: "0px",
                left: "0px",
                right: "0px"
            };
        } else {
            options.width = "480px";
        }
        dialog.open(IntroDialogComponent, options);
    }

    public close() {
        this.store.dispatch(new StopShowingIntroAction());
        this.dialogRef.close();
    }

    public getLanuguageCode(): string {
        return this.store.selectSnapshot((s) => s.configuration.language.code);
    }
}