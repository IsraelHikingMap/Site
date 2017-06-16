import { Component } from "@angular/core";
import { SidebarService } from "../../services/SidebarService";
import { ResourcesService } from "../../services/ResourcesService";
import { MapService } from "../../services/MapService";
import { BaseMapComponent } from "../BaseMapComponent";

@Component({
    selector: "sidebar",
    templateUrl: "./sidebar.html",
    styleUrls: ["./sidebar.css"]
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