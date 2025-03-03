import { Component, inject } from "@angular/core";
import { transition, trigger, style, animate } from "@angular/animations";
import { NgIf, NgSwitch, NgSwitchCase } from "@angular/common";

import { LayersSidebarComponent } from "./layers-sidebar.component";
import { InfoSidebarComponent } from "./info-sidebar.component";
import { PublicPoiSidebarComponent } from "./publicpoi/public-poi-sidebar.component";
import { SidebarService, SidebarView } from "../../services/sidebar.service";
import { ResourcesService } from "../../services/resources.service";

@Component({
    selector: "sidebar",
    templateUrl: "./sidebar.component.html",
    styleUrls: ["./sidebar.component.scss"],
    animations: [
        trigger("animateSidebar", [
            transition(":enter", [
                style({ transform: "translateX(-100%)" }),
                animate("500ms", style({ transform: "translateX(0)" }))
            ]),
            transition(":leave", [
                style({ transform: "translateX(0)" }),
                animate("500ms", style({ transform: "translateX(-100%)" }))
            ])
        ])
    ],
    imports: [NgIf, NgSwitch, NgSwitchCase, LayersSidebarComponent, InfoSidebarComponent, PublicPoiSidebarComponent]
})
export class SidebarComponent {

    public readonly resources = inject(ResourcesService);
    
    private readonly sidebarService = inject(SidebarService);

    public visible: boolean = false;
    public viewName: SidebarView = "";

    constructor() {
        this.sidebarService.sideBarStateChanged.subscribe(() => {
            this.viewName = this.sidebarService.viewName;
            this.visible = this.sidebarService.isSidebarOpen();
        });
    }
}
