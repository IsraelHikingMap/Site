import { Injectable } from "@angular/core";
import { NgRedux } from "@angular-redux/store";

import { HashService } from "./hash.service";
import { SetSidebarAction } from "../reducres/poi.reducer";
import { ApplicationState } from "../models/models";

export type SidebarView = "info" | "layers" | "public-poi" | "";

@Injectable()
export class SidebarService {

    public viewName: SidebarView;
    public isVisible: boolean;

    constructor(private readonly hashService: HashService,
        private readonly ngRedux: NgRedux<ApplicationState>) {
        this.hideWithoutChangingAddressbar();
    }

    public toggle = (viewName: SidebarView) => {
        if (this.viewName === viewName) {
            this.hide();
        } else {
            this.show(viewName);
        }
    }

    public show(viewName: SidebarView) {
        this.isVisible = true;
        this.viewName = viewName;
        this.ngRedux.dispatch(new SetSidebarAction({
            isOpen: false
        }));
        this.hashService.resetAddressbar();

    }

    public hide = () => {
        this.hideWithoutChangingAddressbar();
        this.hashService.resetAddressbar();
    }

    public hideWithoutChangingAddressbar() {
        this.isVisible = false;
        this.viewName = "";
    }
}