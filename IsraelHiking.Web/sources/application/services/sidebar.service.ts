import { Injectable } from "@angular/core";

export type SidebarView = "info" | "layers" | "public-poi" | "";

@Injectable()
export class SidebarService {

    public viewName: SidebarView;
    public isVisible: boolean;

    private data: any;

    public get poiData(): any {
        return this.data;
    }

    public set poiData(data: any) {
        if (!this.data || data["id"] === this.data["id"]) {
            this.data = data;
            this.toggle("public-poi");
        } else {
            this.hide();
            this.data = data;
            // HM TODO: make this look good - refresh or something
            setTimeout(() => this.toggle("public-poi"), 0);
        }
    };

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