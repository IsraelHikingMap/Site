import { Component, Input } from "@angular/core";

import { ClosableOverlayComponent } from "./closable-overlay.component";
import { ResourcesService } from "../../services/resources.service";

@Component({
    selector: "public-poi-hover-overlay",
    templateUrl: "./public-poi-hover-overlay.component.html",
    styleUrls: ["./public-poi-hover-overlay.component.scss"]
})
export class PublicPoiHoverOverlayComponent extends ClosableOverlayComponent {

    @Input()
    public title: string;

    constructor(resources: ResourcesService) {
        super(resources);
    }
}