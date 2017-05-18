import { Component } from "@angular/core";
import { SidebarService } from "../../services/SidebarService";
import { ResourcesService } from "../../services/ResourcesService";
import { MapService } from "../../services/MapService";

@Component({
    selector: "sidebar",
    templateUrl: "application/components/sidebar/sidebar.html",
    styleUrls: ["application/components/sidebar/sidebar.css"]
})

export class SidebarComponent {
    constructor(public resources: ResourcesService,
        private sidebarService: SidebarService,
        private mapService: MapService) {
    }

    public getIsSidebarVisible() {
        return this.sidebarService.isVisible;
    }

    public getViewName() {
        return this.sidebarService.viewName;
    }
}