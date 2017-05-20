import { Component } from "@angular/core";
import { SidebarService } from "../../services/SidebarService";
import { ResourcesService } from "../../services/ResourcesService";
import { MapService } from "../../services/MapService";

@Component({
    selector: "sidebar",
    moduleId: module.id,
    templateUrl: "sidebar.html",
    styleUrls: ["sidebar.css"]
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