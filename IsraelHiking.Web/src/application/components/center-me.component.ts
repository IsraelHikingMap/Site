import { Component } from "@angular/core";

import { BaseMapComponent } from "./base-map.component";
import { ResourcesService } from "../services/resources.service";
import { NgRedux } from "../reducers/infra/ng-redux.module";
import { SetPannedAction } from "../reducers/in-memory.reducer";
import { ApplicationState } from "../models/models";

@Component({
    selector: "center-me",
    templateUrl: "./center-me.component.html"
})
export class CenterMeComponent extends BaseMapComponent {

    constructor(resources: ResourcesService,
                private readonly ngRedux: NgRedux<ApplicationState>) {
        super(resources);
    }

    public showButton() {
        let inMemeoryState = this.ngRedux.getState().inMemoryState;
        let tracking = this.ngRedux.getState().gpsState.tracking;
        return inMemeoryState.pannedTimestamp != null && tracking === "tracking";
    }

    public centerMe() {
        this.ngRedux.dispatch(new SetPannedAction({pannedTimestamp: null}));
    }
}
