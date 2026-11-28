import { Component, input, output } from "@angular/core";
import { MatButton } from "@angular/material/button";
import { MatMenuPanel, MatMenuTrigger } from "@angular/material/menu";

/**
 * One of the round, labelled buttons in the row of actions of a details sheet. It reports a press with
 * {@link pressed} rather than leaving it to a click listener on the element, which would also hear the
 * clicks of a disabled button.
 */
@Component({
    selector: "action-button",
    templateUrl: "./action-button.component.html",
    imports: [MatButton, MatMenuTrigger],
    host: { class: "flex min-w-0 flex-1" }
})
export class ActionButtonComponent {
    public readonly icon = input.required<string>();
    public readonly label = input.required<string>();
    /** Whether this is the main action of the row, which stands out from the others */
    public readonly primary = input(false);
    public readonly disabled = input(false);
    public readonly menu = input<MatMenuPanel>(null);
    public readonly pressed = output();
}
