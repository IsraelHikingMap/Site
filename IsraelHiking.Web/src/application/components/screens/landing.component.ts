import { Component, inject } from "@angular/core";
import { ResourcesService } from "../../services/resources.service";
import { RouterLink } from "@angular/router";
import { Dir } from "@angular/cdk/bidi";
import mapsAnimationData from "../../../content/lottie/dialog-maps.json";
import planAnimationData from "../../../content/lottie/dialog-plan.json";
import moreAnimationData from "../../../content/lottie/dialog-more.json";

import { RunningContextService } from "../../services/running-context.service";
import { Urls } from "../../urls";
import { AnimationOptions, LottieComponent } from "ngx-lottie";

@Component({
    selector: "landing",
    templateUrl: "./landing.component.html",
    styleUrls: ["./landing.component.scss"],
    imports: [RouterLink, Dir, LottieComponent]
})
export class LandingComponent {
    public androidAppUrl: string = Urls.ANDROID_APP_URL;
    public iosAppUrl: string = Urls.IOS_APP_URL;
    lottieMaps: AnimationOptions = { animationData: mapsAnimationData };
    lottiePlan: AnimationOptions = { animationData: planAnimationData };
    lottieMore: AnimationOptions = { animationData: moreAnimationData };

    public readonly resources = inject(ResourcesService);

    private readonly runningContext = inject(RunningContextService);

    public isMobile(): boolean {
        return this.runningContext.isMobile;
    }

    public isApp(): boolean {
        return this.runningContext.isCapacitor;
    }
}