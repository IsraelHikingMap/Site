import { Component, inject } from "@angular/core";
import { RouterLink } from "@angular/router";

import { ResourcesService } from "../../services/resources.service";
import { RunningContextService } from "../../services/running-context.service";
import { PurchaseService } from "../../services/purchase.service";
import { Urls } from "../../urls";

@Component({
    selector: "landing",
    templateUrl: "./landing.component.html",
    styleUrls: ["./landing.component.scss"],
    imports: [RouterLink]
})
export class LandingComponent {
    public androidAppUrl: string = Urls.ANDROID_APP_URL;
    public iosAppUrl: string = Urls.IOS_APP_URL;

    public readonly resources = inject(ResourcesService);

    private readonly runningContextService = inject(RunningContextService);
    private readonly purchaseService = inject(PurchaseService);

    public isMobile(): boolean {
        return this.runningContextService.isMobile;
    }

    public isApp(): boolean {
        return this.runningContextService.isCapacitor;
    }

    public isShowPurchaseButton(): boolean {
        return this.purchaseService.isPurchaseAvailable() || this.purchaseService.isRenewAvailable();
    }

    public order(): void {
        this.purchaseService.order();
    }
}