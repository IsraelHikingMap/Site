import { Component, computed, input, output } from "@angular/core";
import { MatRipple } from "@angular/material/core";

import { LayerThumbnailComponent } from "./layer-thumbnail.component";

/**
 * A layer in the layers panel, shown by an image of what the map looks like with it - a large tile for the few
 * built-in layers, and a compact row for the user's own, which can be many. An action of the layer, like its legend
 * or its properties, is projected into the tile's corner or the row's end.
 */
@Component({
    selector: "layer-tile",
    templateUrl: "./layer-tile.component.html",
    imports: [MatRipple, LayerThumbnailComponent],
    host: { "[class]": "variant() === 'row' ? 'relative flex flex-row items-center' : 'relative block'" }
})
export class LayerTileComponent {
    public readonly label = input.required<string>();
    public readonly thumbnail = input<string>(null);
    public readonly selected = input(false);
    /** A layer the user can not use yet, such as one that comes with a subscription, which is grayed out and marked as such. */
    public readonly locked = input(false);
    public readonly variant = input<"tile" | "row">("tile");
    public readonly pick = output<Event>();

    protected readonly isRow = computed(() => this.variant() === "row");
}
