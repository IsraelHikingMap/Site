import { Component } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Store } from "@ngxs/store";

import { BaseMapComponent } from "./base-map.component";
import { ResourcesService } from "../services/resources.service";
import type { ApplicationState } from "../models/models";

@Component({
    selector: "background-text",
    templateUrl: "./background-text.component.html",
    styleUrls: ["./background-text.component.scss"]
})
export class BackgroundTextComponent extends BaseMapComponent {

    public text: string;

    constructor(resources: ResourcesService,
        private readonly store: Store) {
        super(resources);

        this.text = "";
        this.store.select((state: ApplicationState) => state.offlineState.isOfflineAvailable).pipe(takeUntilDestroyed()).subscribe(() => this.updateText());
        this.store.select((state: ApplicationState) => state.offlineState.lastModifiedDate).pipe(takeUntilDestroyed()).subscribe(() => this.updateText());
        this.store.select((state: ApplicationState) => state.configuration.language).pipe(takeUntilDestroyed()).subscribe(() => this.updateText());
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
