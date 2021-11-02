import { Input, Output, EventEmitter, Component } from "@angular/core";

import { BaseMapComponent } from "../base-map.component";
import { ResourcesService } from "../../services/resources.service";
import type { LatLngAlt } from "../../models/models";

@Component({ template: "" })
export class ClosableOverlayComponent extends BaseMapComponent {
    @Input()
    public isOpen: boolean;

    @Output()
    public closed: EventEmitter<any>;

    @Input()
    public latlng: LatLngAlt;

    constructor(resources: ResourcesService) {
        super(resources);

        this.closed = new EventEmitter();
    }

    public close() {
        this.isOpen = false;
        this.closed.emit();
    }
}
