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
    
    constructor(resources: ResourcesService,
        private readonly hashService: HashService) {
        super(resources);
    }

    public navigate() {
        if (window.self === window.top) {
            window.location.href = Urls.baseAddress;
            return;
        }
        this.hashService.openNewTab();
    }

    public getTooltipText() {
        if (window.self === window.top) {
            return "";
        } else {
            return this.resources.openInANewWindow;
        }
    }
}