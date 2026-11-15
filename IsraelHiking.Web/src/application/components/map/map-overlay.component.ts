import { afterNextRender, Component, DestroyRef, ElementRef, inject, viewChild } from "@angular/core";
import { MapService as MglMapService } from "@maplibre/ngx-maplibre-gl";

/**
 * The layer over a map that holds its buttons, laid out with plain css. Placed inside `<mgl-map>`, so the
 * components in it get the map they act on, but `<mgl-map>` does not render what is inside it - so the layer is
 * moved into the map's own container once the map exists. It lets clicks through to the map except on its content.
 */
@Component({
    selector: "map-overlay",
    template: "<div #overlay class='pointer-events-none absolute inset-0 z-2'><ng-content></ng-content></div>"
})
export class MapOverlayComponent {
    private readonly overlay = viewChild.required<ElementRef<HTMLElement>>("overlay");

    constructor() {
        const mapService = inject(MglMapService);
        afterNextRender(() => {
            mapService.mapCreated$.subscribe(() => mapService.mapInstance.getContainer().appendChild(this.overlay().nativeElement));
        });
        inject(DestroyRef).onDestroy(() => this.overlay().nativeElement.remove());
    }
}
