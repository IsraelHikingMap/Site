import { Component } from "@angular/core";
import { BaseMapComponent } from "./base-map.component";
import { SidebarService } from "../services/sidebar.service";
import { ResourcesService } from "../services/resources.service";

@Component({
    selector: "layers",
    templateUrl: "./layers.component.html"
})
export class LayersComponent extends BaseMapComponent {
    constructor(resources: ResourcesService,
        private readonly sidebarService: SidebarService) {
        super(resources);
    }

    public toggleShow(e: Event) {
        this.sidebarService.toggle("layers");
    }

    public isActive(): boolean {
        return this.sidebarService.viewName === "layers";
    }
}