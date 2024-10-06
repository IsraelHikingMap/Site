import { Component } from "@angular/core";
import {
    MatDialog,
    MatDialogConfig,
    MatDialogRef
} from "@angular/material/dialog";
import { AnimationOptions } from "ngx-lottie";
import { Store } from "@ngxs/store";

import { BaseMapComponent } from "../base-map.component";
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
    styleUrls: ["./intro-dialog.component.scss"]
})
export class IntroDialogComponent extends BaseMapComponent {

    lottieLanguage: AnimationOptions = { animationData: languageAnimationData };
    lottieMaps: AnimationOptions = { animationData: mapsAnimationData };
    lottiePlan: AnimationOptions = { animationData: planAnimationData };
    lottieMore: AnimationOptions = { animationData: moreAnimationData };

    public step: number;
    public availableLanguages = AVAILABLE_LANGUAGES;

    constructor(resources: ResourcesService,
            private readonly dialogRef: MatDialogRef<IntroDialogComponent>,
            private readonly store: Store) {
        super(resources);
        this.step = 0;
    }

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
            options.width = "450px";
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
