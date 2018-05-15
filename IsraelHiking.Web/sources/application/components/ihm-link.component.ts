import { Component } from "@angular/core";
import { HashService } from "../services/hash.service";
import { ResourcesService } from "../services/resources.service";
import { BaseMapComponent } from "./base-map.component";
import { Urls } from "../common/Urls";


@Component({
    selector: "ihm-link",
    templateUrl: "./ihm-link.component.html",
    styleUrls: ["./ihm-link.component.css"]
})
export class IhmLinkComponent extends BaseMapComponent {

    public href: string;
    public target: string;

    constructor(resources: ResourcesService,
        private readonly hashService: HashService) {
        super(resources);

        if (window.self === window.top) {
            this.href = Urls.baseAddress;
            this.target = "";
        } else {
            this.href = this.hashService.getHref();
            this.target = "_blank";
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