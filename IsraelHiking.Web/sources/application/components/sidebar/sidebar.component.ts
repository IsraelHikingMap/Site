import { Component } from "@angular/core";
import { SidebarService } from "../../services/sidebar.service";
import { ResourcesService } from "../../services/resources.service";
import { MapService } from "../../services/map.service";
import { BaseMapComponent } from "../base-map.component";

@Component({
    selector: "sidebar",
    templateUrl: "./sidebar.component.html",
    styleUrls: ["./sidebar.component.css"]
})

export class SidebarComponent extends BaseMapComponent {
    constructor(resources: ResourcesService,
        private sidebarService: SidebarService,
        private mapService: MapService) {
        super(resources);
    }

    public getIsSidebarVisible() {
        return this.sidebarService.isVisible;
    }

    public getViewName() {
        return this.sidebarService.viewName;
    }
}