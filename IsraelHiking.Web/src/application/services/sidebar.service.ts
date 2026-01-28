import { Injectable, EventEmitter } from "@angular/core";

export type SidebarView = "layers" | "public-poi" | "private-routes" | "";

@Injectable()
export class SidebarService {

    public viewName: SidebarView = "";
    public sideBarStateChanged = new EventEmitter<void>();

    public toggle(viewName: SidebarView) {
        if (this.viewName === viewName) {
            this.hide();
        } else {
            this.show(viewName);
        }
    }

    public show(viewName: SidebarView) {
        this.viewName = viewName;
        this.sideBarStateChanged.next();
    }

    public hide() {
        this.viewName = "";
        this.sideBarStateChanged.next();
    }

    public isSidebarOpen(): boolean {
        return this.viewName !== "";
    }

}
