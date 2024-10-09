import { Injectable, EventEmitter, inject } from "@angular/core";
import { Store } from "@ngxs/store";

import { HashService } from "./hash.service";
import { SetSidebarAction } from "../reducers/poi.reducer";
import type { ApplicationState } from "../models/models";

export type SidebarView = "info" | "layers" | "public-poi" | "";

@Injectable()
export class SidebarService {

    public viewName: SidebarView;
    public isVisible: boolean;
    public sideBarStateChanged= new EventEmitter<void>();

    private isPoiSidebarOpen = false;

    private readonly hashService = inject(HashService);
    private readonly store = inject(Store);

    constructor() {
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
