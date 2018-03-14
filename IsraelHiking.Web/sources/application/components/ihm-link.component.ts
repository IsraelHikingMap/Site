import { Component } from "@angular/core";
import { HashService } from "../services/hash.service";
import { ResourcesService } from "../services/resources.service";
import { BaseMapComponent } from "./base-map.component";


@Component({
    selector: "ihm-link",
    templateUrl: "./ihm-link.component.html",
    styleUrls: ["./ihm-link.component.css"]
})
export class IhmLinkComponent extends BaseMapComponent {
    public link: string;
    
    constructor(resources: ResourcesService,
        hashService: HashService) {
        super(resources);
        this.link = hashService.getLinkBackToSite();
    }
}