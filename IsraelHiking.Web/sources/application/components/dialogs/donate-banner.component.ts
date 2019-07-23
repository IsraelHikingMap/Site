import { Component } from "@angular/core";
import { LocalStorage } from "ngx-store";

import { BaseMapComponent } from "../base-map.component";
import { ResourcesService } from "../../services/resources.service";

@Component({
    selector: "donate-banner",
    templateUrl: "./donate-banner.component.html",
    styleUrls: ["./donate-banner.component.scss"]
})
export class DonateBannerComponent extends BaseMapComponent {
    private static readonly BANNER_RESTORE_TIMEOUT = 2 * (1000 * 60 * 60 * 24);

    public isOpen: boolean;

    @LocalStorage()
    public showBanner = true;

    @LocalStorage()
    private bannerClickDate: Date = null;

    constructor(resources: ResourcesService) {
        super(resources);
        if (this.showBanner === false) {
            this.isOpen = false;
            return;
        }
        if (this.bannerClickDate == null) {
            this.isOpen = true;
            return;
        }
        this.isOpen = new Date(this.bannerClickDate) < new Date(new Date().getTime() - DonateBannerComponent.BANNER_RESTORE_TIMEOUT);
        console.log(this.bannerClickDate);
    }

    public tellMeMore() {
        this.isOpen = false;
        this.showBanner = false;
    }

    public later() {
        this.isOpen = false;
        this.bannerClickDate = new Date();
    }
}
