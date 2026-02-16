import { Component, inject, input } from "@angular/core";

import { AutomaticLayerPresentationComponent } from "./automatic-layer-presentation.component";
import { LayersService } from "../../services/layers.service";
import { ResourcesService } from "../../services/resources.service";
import type { EditableLayer } from "../../models";

@Component({
    selector: "layers",
    templateUrl: "layers.component.html",
    imports: [AutomaticLayerPresentationComponent]
})
export class LayersComponent {

    public readonly isMainMap = input<boolean>(true);

    public readonly resources = inject(ResourcesService);

    private readonly layersService = inject(LayersService);

    public getBaseLayer() {
        return this.layersService.getSelectedBaseLayer();
    }

    public isOverlayVisible(overlay: EditableLayer) {
        return this.layersService.isOverlayVisible(overlay);
    }

    public getAllOverlays() {
        return this.layersService.getAllOverlays();
    }
}
