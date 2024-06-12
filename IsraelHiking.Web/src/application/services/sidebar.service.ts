import { Injectable, EventEmitter } from "@angular/core";
import { Store } from "@ngxs/store";

import { HashService } from "./hash.service";
import { SetSidebarAction } from "../reducers/poi.reducer";
import type { ApplicationState } from "../models/models";

export type SidebarView = "info" | "layers" | "public-poi" | "";

@Injectable()
export class SidebarService {

    public viewName: SidebarView;
    public isVisible: boolean;
    public sideBarStateChanged: EventEmitter<void>;

    private isPoiSidebarOpen: boolean;

    constructor(private readonly hashService: HashService,
                private readonly store: Store) {
        this.sideBarStateChanged = new EventEmitter();
        this.isPoiSidebarOpen = false;
        this.hideWithoutChangingAddressbar();
        this.store.select((state: ApplicationState) => state.poiState.isSidebarOpen).subscribe((isOpen) => {
            this.isPoiSidebarOpen = isOpen;
            this.sideBarStateChanged.next();
        });
    }

    public toggle(viewName: SidebarView) {
        if (this.viewName === viewName) {
            this.hide();
        } else {
            this.show(viewName);
        }
    }

    public show(viewName: SidebarView) {
        this.isVisible = true;
        this.viewName = viewName;
        this.store.dispatch(new SetSidebarAction(false));
        this.hashService.resetAddressbar();
        this.sideBarStateChanged.next();
    }

    public hide() {
        this.hideWithoutChangingAddressbar();
        this.hashService.resetAddressbar();
    }

    public hideWithoutChangingAddressbar() {
        this.isVisible = false;
        this.viewName = "";
        this.sideBarStateChanged.next();
    }

    public isSidebarOpen(): boolean {
        return this.isVisible || this.isPoiSidebarOpen;
    }

}
