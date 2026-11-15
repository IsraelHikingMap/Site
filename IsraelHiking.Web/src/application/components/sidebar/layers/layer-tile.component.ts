import { Component, computed, input, output, signal } from "@angular/core";
import { MatRipple } from "@angular/material/core";

/**
 * A layer in the layers panel, shown by an image of what the map looks like with it - a large tile for the few
 * built-in layers, and a compact row for the user's own, which can be many. A layer without an image is shown by
 * its initials on a color of its own, so such layers still look different from each other. An action of the
 * layer, like its legend or its properties, is projected into the tile's corner or the row's end.
 */
@Component({
    selector: "layer-tile",
    templateUrl: "./layer-tile.component.html",
    imports: [MatRipple],
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

    protected readonly isBroken = signal(false);
    protected readonly isRow = computed(() => this.variant() === "row");
    /**
     * A few characters that tell layers without an image apart: the first letters of the first two words, or the
     * first letter and the number when the name ends with one, since a series of layers often differs only by it.
     */
    protected readonly initials = computed(() => {
        const words = this.label().split(/\s+/).filter(w => w.length > 0);
        const last = words[words.length - 1] ?? "";
        if (words.length > 1 && /^\d+$/.test(last)) {
            return ([...words[0]][0] + last.slice(0, 3)).toUpperCase();
        }
        if (words.length === 1) {
            return [...last].slice(0, 2).join("").toUpperCase();
        }
        return words.slice(0, 2).map(w => [...w][0]).join("").toUpperCase();
    });
    /** A hue from an FNV-1a hash of the name, which spreads names that differ by one character far apart. */
    protected readonly placeholderColor = computed(() => {
        let hash = 2166136261;
        for (const character of this.label()) {
            hash = Math.imul(hash ^ character.codePointAt(0), 16777619) >>> 0;
        }
        return `hsl(${hash % 360} 55% 50% / 0.25)`;
    });
}
