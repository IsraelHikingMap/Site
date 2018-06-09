import { Injectable } from "@angular/core";

import { HashService } from "./hash.service";

export type SidebarView = "info" | "layers" | "public-poi" | "";

@Injectable()
export class SidebarService {

    public viewName: SidebarView;
    public isVisible: boolean;

    constructor(private readonly hashService: HashService) {
        this.isVisible = false;
        this.viewName = "";
    }

    public toggle = (viewName: SidebarView) => {
        if (this.viewName === viewName) {
            this.hide();
            return;
        }
        if (viewName !== "public-poi") {
            this.hide();
        }
        this.isVisible = true;
        this.viewName = viewName;
    }

    public hide = () => {
        this.isVisible = false;
        this.viewName = "";
        this.hashService.setApplicationState("poi", null);
        this.hashService.resetAddressbar();
    }
}