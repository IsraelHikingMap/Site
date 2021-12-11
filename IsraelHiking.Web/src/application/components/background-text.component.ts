import { Component } from "@angular/core";
import { Observable } from "rxjs";
import { NgRedux, select } from "@angular-redux2/store";

import { BaseMapComponent } from "./base-map.component";
import { ResourcesService } from "../services/resources.service";
import type { ApplicationState, Language } from "../models/models";

@Component({
    selector: "background-text",
    templateUrl: "./background-text.component.html",
    styleUrls: ["./background-text.component.scss"]
})
export class BackgroundTextComponent extends BaseMapComponent {

    @select((state: ApplicationState) => state.offlineState.isOfflineAvailable)
    public isOfflineAvailable$: Observable<boolean>;

    @select((state: ApplicationState) => state.offlineState.lastModifiedDate)
    public lastModifiedDate$: Observable<boolean>;

    @select((state: ApplicationState) => state.configuration.language)
    public language$: Observable<Language>;

    public text: string;

    constructor(resources: ResourcesService,
        private readonly ngRedux: NgRedux<ApplicationState>) {
        super(resources);

        this.text = "";
        this.isOfflineAvailable$.subscribe(() => this.updateText());
        this.lastModifiedDate$.subscribe(() => this.updateText());
        this.language$.subscribe(() => this.updateText());
    }

    private updateText() {
        let offlineState = this.ngRedux.getState().offlineState;
        if (offlineState.isOfflineAvailable && offlineState.lastModifiedDate != null) {
            this.text = this.resources.youNeedToToggleOfflineMaps;
        } else if (offlineState.isOfflineAvailable && offlineState.lastModifiedDate == null) {
            this.text = this.resources.youNeedToDownloadOfflineMaps;
        } else if (!offlineState.isOfflineAvailable) {
            this.text = this.resources.youNeedToPurchaseOfflineMaps;
        }
    }
}
