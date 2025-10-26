import { Component, inject } from "@angular/core";
import { AsyncPipe } from "@angular/common";
import { Angulartics2OnModule } from "angulartics2";
import { Observable } from "rxjs";
import { Store } from "@ngxs/store";
import type { Immutable } from "immer";

import { AutomaticLayerPresentationComponent } from "./automatic-layer-presentation.component";
import { LayersService } from "../../services/layers.service";
import { ResourcesService } from "../../services/resources.service";
import type { ApplicationState, Overlay } from "../../models";

@Component({
    selector: "layers",
    templateUrl: "layers.component.html",
    imports: [AutomaticLayerPresentationComponent, Angulartics2OnModule, AsyncPipe]
})
export class LayersComponent {
    public overlays$: Observable<Immutable<Overlay[]>>;	

    public readonly resources = inject(ResourcesService);

    private readonly layersService = inject(LayersService);
    private readonly store = inject(Store);

    constructor() {
        this.overlays$ = this.store.select((state: ApplicationState) => state.layersState.overlays);
    }

    public getBaseLayer() {
        return this.layersService.getSelectedBaseLayer();
    }

    public trackByKey(_: number, el: Overlay) {
        return el.key;
    }

    public isSameBaselayerOn(overlay: Overlay) {
        return overlay.address === this.getBaseLayer()?.address;
    }
}
