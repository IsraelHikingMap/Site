import { Component, Input, Output, EventEmitter } from "@angular/core";

import { ResourcesService } from "../../services/resources.service";
import { ClosableOverlayComponent } from "./closable-overlay.component";

@Component({
    selector: "clearable-overlay",
    templateUrl: "./clearable-overlay.component.html"
})
export class ClearableOverlayComponent extends ClosableOverlayComponent {

    @Input()
    public title: string;

    @Output()
    public convertToRoute: EventEmitter<any>;

    @Output()
    public cleared: EventEmitter<any>;

    public hideCoordinates: boolean;

    constructor(resources: ResourcesService) {
        super(resources);

        this.hideCoordinates = true;
        this.convertToRoute = new EventEmitter();
        this.cleared = new EventEmitter();
    }
}