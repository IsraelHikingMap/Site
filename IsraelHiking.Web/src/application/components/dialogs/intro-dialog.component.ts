import { Component } from "@angular/core";
import { MatLegacyDialog as MatDialog, MatLegacyDialogConfig as MatDialogConfig, MatLegacyDialogRef as MatDialogRef } from "@angular/material/legacy-dialog";
import { AnimationOptions } from "ngx-lottie";
import { NgRedux } from "@angular-redux2/store";

import { BaseMapComponent } from "../base-map.component";
import { ResourcesService } from "../../services/resources.service";
import { ConfigurationActions } from "../../reducers/configuration.reducer";
import { RunningContextService } from "../../services/running-context.service";
import type { ApplicationState } from "../../models/models";
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

    constructor(resources: ResourcesService,
            private readonly dialogRef: MatDialogRef<IntroDialogComponent>,
            private readonly ngRedux: NgRedux<ApplicationState>) {
        super(resources);
        this.step = 0;
    }

    public static openDialog(dialog: MatDialog, runningContextSerivce: RunningContextService) {
        let options: MatDialogConfig = {};
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
        this.ngRedux.dispatch(ConfigurationActions.stopShowIntroAction);
        this.dialogRef.close();
    }

}
