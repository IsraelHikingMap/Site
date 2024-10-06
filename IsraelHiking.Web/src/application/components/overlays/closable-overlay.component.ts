import { Input, Component, inject, output } from "@angular/core";

import { ResourcesService } from "../../services/resources.service";
import type { LatLngAlt } from "../../models/models";

@Component({ template: "" })
export class ClosableOverlayComponent {
    @Input()
    public isOpen: boolean;

    @Input()
    public latlng: LatLngAlt;

    public closed = output();
    
    public readonly resources = inject(ResourcesService);

    public close() {
        this.isOpen = false;
        this.closed.emit();
    }
}
