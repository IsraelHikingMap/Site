import { Input, Output, EventEmitter, Component, inject } from "@angular/core";

import { ResourcesService } from "../../services/resources.service";
import type { LatLngAlt } from "../../models/models";

@Component({ template: "" })
export class ClosableOverlayComponent {
    @Input()
    public isOpen: boolean;

    @Output()
    public closed = new EventEmitter<void>();

    @Input()
    public latlng: LatLngAlt;

    public readonly resources = inject(ResourcesService);

    public close() {
        this.isOpen = false;
        this.closed.emit();
    }
}
