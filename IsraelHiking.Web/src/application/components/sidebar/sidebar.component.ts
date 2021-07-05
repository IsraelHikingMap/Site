import { Component } from "@angular/core";
import { transition, trigger, style, animate } from "@angular/animations";

import { SidebarService, SidebarView } from "../../services/sidebar.service";
import { ResourcesService } from "../../services/resources.service";
import { BaseMapComponent } from "../base-map.component";

export const sidebarAnimate = trigger(
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
        sidebarAnimate
    ]
})
export class SidebarComponent extends BaseMapComponent {
    constructor(resources: ResourcesService,
                private sidebarService: SidebarService) {
        super(resources);
    }

    public isSidebarVisible(): boolean {
        return this.sidebarService.isVisible;
    }

    public getViewName(): SidebarView {
        return this.sidebarService.viewName;
    }

    public getTitle(): string {
        switch (this.sidebarService.viewName) {
            case "layers":
                return this.resources.layers;
            case "info":
                return this.resources.about + " - " + this.resources.legend;
        }
        return "";
    }

    public close() {
        this.sidebarService.hide();
    }
}
