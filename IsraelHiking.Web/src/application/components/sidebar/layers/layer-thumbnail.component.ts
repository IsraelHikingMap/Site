import { Component, computed, input, signal } from "@angular/core";

/**
 * The image of what a map looks like, as shown for a layer in the layers panel and in the dialog that manages them.
 * A layer without an image, or whose image fails to load, is shown by its initials on a color of its own, so such
 * layers still look different from each other.
 */
@Component({
    selector: "layer-thumbnail",
    templateUrl: "./layer-thumbnail.component.html",
    host: {
        "class": "relative block shrink-0 overflow-hidden rounded-lg border-2 border-solid",
        "[class.border-brand]": "selected()",
        "[class.border-outline-variant]": "!selected()"
    }
})
export class LayerThumbnailComponent {
    public readonly label = input.required<string>();
    public readonly thumbnail = input<string>(null);
    public readonly selected = input(false);
    /** A layer the user can not use yet, such as one that comes with a subscription, which is grayed out and marked as such. */
    public readonly locked = input(false);
    /** Draws the initials and the marks smaller, for the compact rows. */
    public readonly small = input(false);

    protected readonly isBroken = signal(false);
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
