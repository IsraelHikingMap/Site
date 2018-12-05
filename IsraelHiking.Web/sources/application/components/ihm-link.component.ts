import { Component } from "@angular/core";
import { HashService } from "../services/hash.service";
import { ResourcesService } from "../services/resources.service";
import { BaseMapComponent } from "./base-map.component";
import { Urls } from "../urls";


@Component({
    selector: "ihm-link",
    templateUrl: "./ihm-link.component.html",
    styleUrls: ["./ihm-link.component.scss"]
})
export class IhmLinkComponent extends BaseMapComponent {

    public target: string;

    constructor(resources: ResourcesService,
        private readonly hashService: HashService) {
        super(resources);

        if (window.self === window.top) {
            this.target = "";
        } else {
            this.target = "_blank";
        }
    }

    public getHref() {
        if (window.self === window.top) {
            return Urls.baseAddress;
        } else {
            return this.hashService.getHref();
        }
    }

    public getTooltipText() {
        if (window.self === window.top) {
            return "";
        } else {
            return this.resources.openInANewWindow;
        }
    }
}