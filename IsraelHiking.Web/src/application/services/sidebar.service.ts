import { Injectable, EventEmitter } from "@angular/core";
import { Observable } from "rxjs";
import { NgRedux, select } from "@angular-redux2/store";

import { HashService } from "./hash.service";
import { SetSidebarAction } from "../reducers/poi.reducer";
import type { ApplicationState } from "../models/models";

export type SidebarView = "info" | "layers" | "public-poi" | "";

@Injectable()
export class SidebarService {

    public viewName: SidebarView;
    public isVisible: boolean;
    public sideBarStateChanged: EventEmitter<void>;

    @select((state: ApplicationState) => state.poiState.isSidebarOpen)
    private isPoiSidebarOpen$: Observable<boolean>;

    private isPoiSidebarOpen: boolean;

    constructor(private readonly hashService: HashService,
                private readonly ngRedux: NgRedux<ApplicationState>) {
        this.sideBarStateChanged = new EventEmitter();
        this.isPoiSidebarOpen = false;
        this.hideWithoutChangingAddressbar();
        this.isPoiSidebarOpen$.subscribe((isOpen) => {
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
        this.ngRedux.dispatch(new SetSidebarAction({
            isOpen: false
        }));
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
