import { afterNextRender, Component, DestroyRef, effect, ElementRef, inject, input } from "@angular/core";
import { MapService as MglMapService } from "@maplibre/ngx-maplibre-gl";
import { ScaleControl } from "maplibre-gl";

/**
 * Maplibre's scale bar, placed in the map overlay with the other controls rather than in a maplibre corner. The
 * control builds and updates its own element once it is given the map, which is all a corner would do with it.
 */
@Component({
    selector: "scale-bar",
    template: "",
    host: { class: "block" }
})
export class ScaleBarComponent {
    public readonly unit = input.required<"metric" | "imperial">();

    private control: ScaleControl = null;

    constructor() {
        const mapService = inject(MglMapService);
        const host = inject<ElementRef<HTMLElement>>(ElementRef);
        afterNextRender(() => {
            mapService.mapCreated$.subscribe(() => {
                this.control = new ScaleControl({ unit: this.unit() });
                host.nativeElement.appendChild(this.control.onAdd(mapService.mapInstance));
            });
        });
        effect(() => {
            const unit = this.unit();
            this.control?.setUnit(unit);
        });
        inject(DestroyRef).onDestroy(() => this.control?.onRemove());
    }
}
