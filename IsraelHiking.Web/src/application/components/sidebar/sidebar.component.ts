import { Component, inject, signal } from "@angular/core";

import { LayersSidebarComponent } from "./layers/layers-sidebar.component";
import { PublicPoiSidebarComponent } from "./publicpoi/public-poi-sidebar.component";
import { PrivateRoutesSidebarComponent } from "./privateroutes/private-routes-sidebar.component";
import { SidebarService, SidebarView } from "../../services/sidebar.service";
import { ResourcesService } from "../../services/resources.service";

@Component({
    selector: "sidebar",
    templateUrl: "./sidebar.component.html",
    styleUrls: ["./sidebar.component.scss"],
    imports: [LayersSidebarComponent, PublicPoiSidebarComponent, PrivateRoutesSidebarComponent]
})
export class SidebarComponent {

    public readonly resources = inject(ResourcesService);

    private readonly sidebarService = inject(SidebarService);

    public visible = signal(false);
    public viewName: SidebarView = "";

    constructor() {
        this.sidebarService.sideBarStateChanged.subscribe(() => {
            this.viewName = this.sidebarService.viewName;
            this.visible.set(this.sidebarService.isSidebarOpen());
        });
    }
}
