import { Component, Input, Output, EventEmitter } from "@angular/core";

import { ClosableOverlayComponent } from "./closable-overlay.component";

@Component({
    selector: "clearable-overlay",
    templateUrl: "./clearable-overlay.component.html",
    styleUrls: ["./clearable-overlay.component.scss"]
})
export class ClearableOverlayComponent extends ClosableOverlayComponent {

    @Input()
    public title: string;

    @Output()
    public convertToRoute = new EventEmitter<void>();

    @Output()
    public cleared = new EventEmitter<void>();

    public hideCoordinates: boolean = true;
}
