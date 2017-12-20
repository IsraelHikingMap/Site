import { Component } from "@angular/core";
import {HashService} from "../services/hash.service";

@Component({
    selector: "ihm-link",
    templateUrl: "./Ihm-link.component.html",
    styleUrls: ["./Ihm-link.component.css"]
})
export class IhmLinkComponent {
    public link: string;
    
    constructor(hashService: HashService) {
        this.link = hashService.getLinkBackToSite();
    }
}