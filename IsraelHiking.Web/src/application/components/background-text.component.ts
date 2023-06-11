import { Component } from "@angular/core";
import { Observable } from "rxjs";
import { Store, Select } from "@ngxs/store";

import { BaseMapComponent } from "./base-map.component";
import { ResourcesService } from "../services/resources.service";
import type { ApplicationState, Language } from "../models/models";

@Component({
    selector: "background-text",
    templateUrl: "./background-text.component.html",
    styleUrls: ["./background-text.component.scss"]
})
export class BackgroundTextComponent extends BaseMapComponent {

    @Select((state: ApplicationState) => state.offlineState.isOfflineAvailable)
    public isOfflineAvailable$: Observable<boolean>;

    @Select((state: ApplicationState) => state.offlineState.lastModifiedDate)
    public lastModifiedDate$: Observable<boolean>;

    @Select((state: ApplicationState) => state.configuration.language)
    public language$: Observable<Language>;

    public text: string;

    constructor(resources: ResourcesService,
        private readonly store: Store) {
        super(resources);

        this.text = "";
        this.isOfflineAvailable$.subscribe(() => this.updateText());
        this.lastModifiedDate$.subscribe(() => this.updateText());
        this.language$.subscribe(() => this.updateText());
    }

    private updateText() {
        const offlineState = this.store.selectSnapshot((s: ApplicationState) => s.offlineState);
        if (offlineState.lastModifiedDate != null) {
            this.text = this.resources.youNeedToToggleOfflineMaps;
        } else if (offlineState.isOfflineAvailable && offlineState.lastModifiedDate == null) {
            this.text = this.resources.youNeedToDownloadOfflineMaps;
        } else if (!offlineState.isOfflineAvailable) {
            this.text = this.resources.youNeedToPurchaseOfflineMaps;
        }
    }
}
