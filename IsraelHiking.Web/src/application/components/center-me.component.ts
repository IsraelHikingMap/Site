import { Component } from "@angular/core";
import { NgRedux } from "@angular-redux2/store";

import { BaseMapComponent } from "./base-map.component";
import { ResourcesService } from "../services/resources.service";
import { InMemoryReducer } from "../reducers/in-memory.reducer";
import type { ApplicationState } from "../models/models";

@Component({
    selector: "center-me",
    templateUrl: "./center-me.component.html",
    styleUrls: ["./center-me.component.scss"]
})
export class CenterMeComponent extends BaseMapComponent {

    constructor(resources: ResourcesService,
                private readonly ngRedux: NgRedux<ApplicationState>) {
        super(resources);
    }

    public showButton() {
        let inMemeoryState = this.ngRedux.getState().inMemoryState;
        let tracking = this.ngRedux.getState().gpsState.tracking;
        return inMemeoryState.pannedTimestamp != null && inMemeoryState.following && tracking === "tracking";
    }

    public centerMe() {
        this.ngRedux.dispatch(InMemoryReducer.actions.setPanned({pannedTimestamp: null}));
    }
}
