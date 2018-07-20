import { Component } from "@angular/core";
import { transition, trigger, style, animate } from "@angular/animations";

import { SidebarService } from "../../services/sidebar.service";
import { ResourcesService } from "../../services/resources.service";
import { MapService } from "../../services/map.service";
import { BaseMapComponent } from "../base-map.component";

@Component({
    selector: "sidebar",
    templateUrl: "./sidebar.component.html",
    styleUrls: ["./sidebar.component.scss"],
    animations: [
        trigger(
            "animateSidebar",
            [
                transition(
                    ":enter", [
                        style({ transform: "translateX(-100%)" }),
                        animate("500ms", style({ transform: "translateX(0)" }))
                    ]
                ),
                transition(
                    ":leave", [
                        style({ transform: "translateX(0)" }),
                        animate("500ms", style({ transform: "translateX(-100%)" }))
                    ]
                )]
        )
    ],
})

export class SidebarComponent extends BaseMapComponent {
    constructor(resources: ResourcesService,
        private sidebarService: SidebarService,
        private mapService: MapService) {
        super(resources);
    }

    public isSidebarVisible() {
        return this.sidebarService.isVisible;
    }

    public getViewName() {
        return this.sidebarService.viewName;
    }
}