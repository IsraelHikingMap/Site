import { Component, inject } from "@angular/core";
import { NgIf } from "@angular/common";
import { MatButton } from "@angular/material/button";
import { Angulartics2OnModule } from "angulartics2";
import { Store } from "@ngxs/store";

import { ResourcesService } from "../services/resources.service";
import { SetPannedAction } from "../reducers/in-memory.reducer";
import type { ApplicationState } from "../models";

@Component({
    selector: "center-me",
    templateUrl: "./center-me.component.html",
    styleUrls: ["./center-me.component.scss"],
    imports: [NgIf, MatButton, Angulartics2OnModule]
})
export class CenterMeComponent {

    public readonly resources = inject(ResourcesService);

    private readonly store = inject(Store);
    

    public showButton() {
        const inMemeoryState = this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState);
        const tracking = this.store.selectSnapshot((s: ApplicationState) => s.gpsState.tracking);
        return inMemeoryState.pannedTimestamp != null && inMemeoryState.following && tracking === "tracking";
    }

    public centerMe() {
        this.store.dispatch(new SetPannedAction(null));
    }
}
