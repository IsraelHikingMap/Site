import { Component, inject } from "@angular/core";
import { ResourcesService } from "../../services/resources.service";
import { MatCard, MatCardContent } from "@angular/material/card";
import { MatDivider } from "@angular/material/divider";
import { RouterLink } from "@angular/router";
import { Dir } from "@angular/cdk/bidi";

import { RunningContextService } from "../../services/running-context.service";
import { Urls } from "../../urls";

@Component({
    selector: "landing",
    templateUrl: "./landing.component.html",
    styleUrls: ["./landing.component.scss"],
    imports: [MatCard, MatCardContent, MatDivider, RouterLink, Dir]
})
export class LandingComponent {
    public androidAppUrl: string = Urls.ANDROID_APP_URL;
    public iosAppUrl: string = Urls.IOS_APP_URL;

    public readonly resources = inject(ResourcesService);

    private readonly runningContext = inject(RunningContextService);

    public isMobile(): boolean {
        return this.runningContext.isMobile;
    }

    public isApp(): boolean {
        return this.runningContext.isCapacitor;
    }
}