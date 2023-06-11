import { Component } from "@angular/core";
import { Store } from "@ngxs/store";

import { BaseMapComponent } from "./base-map.component";
import { ResourcesService } from "../services/resources.service";
import { SetPannedAction } from "../reducers/in-memory.reducer";
import type { ApplicationState } from "../models/models";

@Component({
    selector: "center-me",
    templateUrl: "./center-me.component.html",
    styleUrls: ["./center-me.component.scss"]
})
export class CenterMeComponent extends BaseMapComponent {

    constructor(resources: ResourcesService,
                private readonly store: Store) {
        super(resources);
    }

    public showButton() {
        const inMemeoryState = this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState);
        const tracking = this.store.selectSnapshot((s: ApplicationState) => s.gpsState.tracking);
        return inMemeoryState.pannedTimestamp != null && inMemeoryState.following && tracking === "tracking";
    }

    public centerMe() {
        this.store.dispatch(new SetPannedAction(null));
    }
}
