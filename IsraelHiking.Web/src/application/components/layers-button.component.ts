import { Component, inject } from "@angular/core";
import { MatTooltipModule } from "@angular/material/tooltip";
import { MatButton } from "@angular/material/button";

import { SidebarService } from "../services/sidebar.service";
import { ResourcesService } from "../services/resources.service";

@Component({
    selector: "layers-button",
    templateUrl: "./layers-button.component.html",
    imports: [MatTooltipModule, MatButton]
})
export class LayersButtonComponent {

    public readonly resources = inject(ResourcesService);
    private readonly sidebarService = inject(SidebarService);

    public openLayersSidebar() {
        this.sidebarService.show("layers");
    }
}