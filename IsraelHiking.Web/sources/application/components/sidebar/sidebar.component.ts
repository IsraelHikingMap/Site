import { Component } from "@angular/core";
import { transition, trigger, style, animate } from "@angular/animations";

import { SidebarService } from "../../services/sidebar.service";
import { ResourcesService } from "../../services/resources.service";
import { BaseMapComponent } from "../base-map.component";

export const sibebarAnimate = trigger(
    "animateSidebar",
    [
        transition(
            ":enter",
            [
                style({ transform: "translateX(-100%)" }),
                animate("500ms", style({ transform: "translateX(0)" }))
            ]
        ),
        transition(
            ":leave",
            [
                style({ transform: "translateX(0)" }),
                animate("500ms", style({ transform: "translateX(-100%)" }))
            ]
        )
    ]
);

@Component({
    selector: "sidebar",
    templateUrl: "./sidebar.component.html",
    styleUrls: ["./sidebar.component.scss"],
    animations: [
        sibebarAnimate
    ]
})
export class SidebarComponent extends BaseMapComponent {
    constructor(resources: ResourcesService,
        private sidebarService: SidebarService) {
        super(resources);
    }

    public isSidebarVisible() {
        return this.sidebarService.isVisible;
    }

    public getViewName() {
        return this.sidebarService.viewName;
    }
}