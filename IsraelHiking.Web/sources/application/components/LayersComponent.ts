import { Component } from "@angular/core";
import { BaseMapComponent } from "./BaseMapComponent";
import { SidebarService } from "../services/SidebarService";
import { ResourcesService } from "../services/ResourcesService";

@Component({
    selector: "layers",
    templateUrl: "./layers.html"
})
export class LayersComponent extends BaseMapComponent {
    constructor(private sidebarService: SidebarService, resources: ResourcesService) {
        super(resources);
    }

    public toggleShow(e: Event) {
        this.sidebarService.toggle("layers");
        this.suppressEvents(e);
    }

    public isVisisble(): boolean {
        return this.sidebarService.viewName === "layers";
    }
}