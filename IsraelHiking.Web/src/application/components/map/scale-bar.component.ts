import { afterNextRender, Component, DestroyRef, ElementRef, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { MapService as MglMapService } from "@maplibre/ngx-maplibre-gl";
import { ScaleControl } from "maplibre-gl";
import { Store } from "@ngxs/store";

import type { ApplicationState } from "../../models";

/**
 * Maplibre's scale bar, placed in the map overlay with the other controls rather than in a maplibre corner. The
 * control builds and updates its own element once it is given the map, which is all a corner would do with it,
 * and is told the units the user picked.
 */
@Component({
    selector: "scale-bar",
    template: "",
    host: { class: "block" }
})
export class ScaleBarComponent {
    private readonly mglMapService = inject(MglMapService);
    private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
    private readonly destroyRef = inject(DestroyRef);
    private readonly store = inject(Store);

    private control: ScaleControl = null;

    constructor() {
        afterNextRender(() => {
            this.mglMapService.mapCreated$.subscribe(() => {
                this.control = new ScaleControl();
                this.host.nativeElement.appendChild(this.control.onAdd(this.mglMapService.mapInstance));
                this.store.select((state: ApplicationState) => state.configuration.units).pipe(takeUntilDestroyed(this.destroyRef))
                    .subscribe(units => this.control.setUnit(units));
            });
        });
        this.destroyRef.onDestroy(() => this.control?.onRemove());
    }
}
