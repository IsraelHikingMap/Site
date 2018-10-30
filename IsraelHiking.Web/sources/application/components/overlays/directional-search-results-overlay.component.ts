import { Component, Input, Output, EventEmitter } from "@angular/core";
import { HttpClient } from "@angular/common/http";

import { ResourcesService } from "../../services/resources.service";
import { ElevationProvider } from "../../services/elevation.provider";
import { ClosableOverlayComponent } from "./closable-overlay.component";


@Component({
    selector: "directional-search-results-overlay",
    templateUrl: "./directional-search-results-overlay.component.html"
})
export class DirectionalSearchResultsOverlayComponent extends ClosableOverlayComponent {

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