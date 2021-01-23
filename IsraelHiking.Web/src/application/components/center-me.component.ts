import { Component } from "@angular/core";
import { NgRedux } from "@angular-redux/store";

import { BaseMapComponent } from "./base-map.component";
import { ResourcesService } from "../services/resources.service";
import { SetPannedAction } from "../reducres/in-memory.reducer";
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
        return inMemeoryState.pannedTimestamp != null && inMemeoryState.geoLocation === "tracking";
    }

    public centerMe() {
        this.ngRedux.dispatch(new SetPannedAction({pannedTimestamp: null}));
    }
}
