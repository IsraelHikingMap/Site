import { Component, computed, input } from "@angular/core";

type TextPart = {
    text: string;
    isMatch: boolean;
};

/**
 * Shows a text where every occurrence of the search term is marked,
 * so that the relation between the search term and the results is clear.
 */
@Component({
    selector: "highlighted-text",
    templateUrl: "./highlighted-text.component.html",
    styleUrls: ["./highlighted-text.component.scss"]
})
export class HighlightedTextComponent {
    public readonly text = input<string>("");
    public readonly searchTerm = input<string>("");

    public readonly parts = computed<TextPart[]>(() => {
        const text = this.text() || "";
        const searchTerm = (this.searchTerm() || "").trim();
        if (!searchTerm) {
            return [{ text, isMatch: false }];
        }
        const escapedSearchTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        // Splitting by a regular expression with a capturing group returns the matches in the odd indices.
        return text.split(new RegExp(`(${escapedSearchTerm})`, "gi"))
            .map((part, index) => ({ text: part, isMatch: index % 2 === 1 }))
            .filter((part) => part.text !== "");
    });
}
