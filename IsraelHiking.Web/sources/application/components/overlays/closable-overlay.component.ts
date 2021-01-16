import { Input, Output, EventEmitter, Directive } from "@angular/core";

import { BaseMapComponent } from "../base-map.component";
import { ResourcesService } from "../../services/resources.service";
import { LatLngAlt } from "../../models/models";

export abstract class ClosableOverlayComponent extends BaseMapComponent {
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
