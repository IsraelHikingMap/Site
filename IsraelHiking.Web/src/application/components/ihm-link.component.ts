import { Component, inject } from "@angular/core";
import { MatTooltip } from "@angular/material/tooltip";

import { Angulartics2OnModule } from "angulartics2";

import { HashService } from "../services/hash.service";
import { ResourcesService } from "../services/resources.service";
import { RunningContextService } from "../services/running-context.service";
import { Urls } from "../urls";

@Component({
    selector: "ihm-link",
    templateUrl: "./ihm-link.component.html",
    styleUrls: ["./ihm-link.component.scss"],
    imports: [Angulartics2OnModule, MatTooltip]
})
export class IhmLinkComponent {

    public target: string = "";

    public readonly resources = inject(ResourcesService);

    private readonly hashService = inject(HashService);
    private readonly runningContextService = inject(RunningContextService);

    constructor() {
        if (this.runningContextService.isIFrame) {
            this.target = "_blank";
        }
    }

    public getHref(): string {
        if (this.runningContextService.isIFrame) {
            return this.hashService.getHref();
        } else {
            return Urls.baseAddress;
        }
    }

    public getTooltipText(): string {
        if (this.runningContextService.isIFrame) {
            return this.resources.openInANewWindow;
        } else {
            return "";
        }
    }

    public isIFrameMobile() {
        return this.runningContextService.isIFrame && this.runningContextService.isMobile;
    }
}
