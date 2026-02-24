import { Component, inject } from "@angular/core";
import { MatLabel } from "@angular/material/input";
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
import { AVAILABLE_LANGUAGES, HIKING_MAP, MTB_MAP } from "../../reducers/initial-state";
import { RunningContextService } from "../../services/running-context.service";
import { SetActivityTypeAction } from "../../reducers/user.reducer";
import { SelectBaseLayerAction } from "../../reducers/layers.reducer";
import { SetRoutingTypeAction } from "../../reducers/route-editing.reducer";
import type { ActivityType } from "../../models";

import languageAnimationData from "../../../content/lottie/dialog-language.json";
import mapsAnimationData from "../../../content/lottie/dialog-maps.json";
import planAnimationData from "../../../content/lottie/dialog-plan.json";
import moreAnimationData from "../../../content/lottie/dialog-more.json";

@Component({
    selector: "intro-dialog",
    templateUrl: "./intro-dialog.component.html",
    styleUrls: ["./intro-dialog.component.scss"],
    imports: [Dir, CdkScrollable, MatDialogContent, MatRadioGroup, MatRadioButton, Angulartics2OnModule, LottieComponent, MatDialogActions, MatButton, MatLabel]
})
export class IntroDialogComponent {

    public lottieLanguage: AnimationOptions = { animationData: languageAnimationData };
    public lottieMaps: AnimationOptions = { animationData: mapsAnimationData };
    public lottiePlan: AnimationOptions = { animationData: planAnimationData };
    public lottieMore: AnimationOptions = { animationData: moreAnimationData };

    public activityType: ActivityType = "Hiking";
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

    public setActivityType(activityType: ActivityType) {
        this.activityType = activityType;
        this.store.dispatch(new SetActivityTypeAction(activityType));
        switch (this.activityType) {
            case "Hiking":
                this.store.dispatch(new SelectBaseLayerAction(HIKING_MAP));
                this.store.dispatch(new SetRoutingTypeAction("Hike"));
                break;
            case "Biking":
                this.store.dispatch(new SelectBaseLayerAction(MTB_MAP));
                this.store.dispatch(new SetRoutingTypeAction("Bike"));
                break;
            case "4x4":
                this.store.dispatch(new SelectBaseLayerAction(HIKING_MAP));
                this.store.dispatch(new SetRoutingTypeAction("4WD"));
                break;
        }
    }
}