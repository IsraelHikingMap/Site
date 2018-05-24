import { Injectable } from "@angular/core";

export type SidebarView = "info" | "layers" | "public-poi" | "";

@Injectable()
export class SidebarService {

    public viewName: SidebarView;
    public isVisible: boolean;

    constructor() {
        this.hide();
    }

    public toggle = (viewName: SidebarView) => {
        if (this.viewName === viewName) {
            this.hide();
            return;
        }
        this.isVisible = true;
        this.viewName = viewName;
    }

    public hide = () => {
        this.isVisible = false;
        this.viewName = "";
    }
}