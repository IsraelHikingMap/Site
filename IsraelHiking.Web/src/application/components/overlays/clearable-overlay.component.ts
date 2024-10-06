import { Component, Input, output } from "@angular/core";

import { ClosableOverlayComponent } from "./closable-overlay.component";

@Component({
    selector: "clearable-overlay",
    templateUrl: "./clearable-overlay.component.html",
    styleUrls: ["./clearable-overlay.component.scss"]
})
export class ClearableOverlayComponent extends ClosableOverlayComponent {

    @Input()
    public title: string;

    public convertToRoute = output();

    public cleared = output();

    public hideCoordinates: boolean = true;
}
