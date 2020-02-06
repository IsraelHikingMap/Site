import { Component } from "@angular/core";
import { Observable } from "rxjs";
import { select, NgRedux } from "@angular-redux/store";

import { BaseMapComponent } from "../base-map.component";
import { ResourcesService } from "../../services/resources.service";
import { RunningContextService } from "../../services/running-context.service";
import { ConfigurationActions } from "../../reducres/configuration.reducer";
import { ApplicationState } from "../../models/models";

@Component({
    selector: "configuration-dialog",
    templateUrl: "./configuration-dialog.component.html"
})
export class ConfigurationDialogComponent extends BaseMapComponent {

    @select((state: ApplicationState) => state.configuration.isAdvanced)
    public isAdvanced: Observable<boolean>;

    @select((state: ApplicationState) => state.configuration.isBatteryOptimization)
    public isBatteryOptimization: Observable<boolean>;

    @select((state: ApplicationState) => state.configuration.isAutomaticRecordingUpload)
    public isAutomaticRecordingUpload: Observable<boolean>;

    // @select((state: ApplicationState) => state.configuration.isFindMissingRoutesAfterUpload)
    // public isFindMissingRoutesAfterUpload: Observable<boolean>;

    constructor(resources: ResourcesService,
                private readonly runningContextService: RunningContextService,
                private readonly ngRedux: NgRedux<ApplicationState>) {
        super(resources);
    }

    public isApp() {
        return this.runningContextService.isCordova;
    }

    public toggleIsAdvanced() {
        this.ngRedux.dispatch(ConfigurationActions.toggleIsAdvanceAction);
    }

    public toggleBatteryOprimization() {
        this.ngRedux.dispatch(ConfigurationActions.toggleIsBatteryOptimizationAction);
    }

    public toggleAutomaticRecordingUpload() {
        this.ngRedux.dispatch(ConfigurationActions.toggleIsAutomaticRecordingUploadAction);
    }

    // public toggleFindMissingRoutesAfterUpload() {
    //    this.ngRedux.dispatch(ConfigurationActions.toggleFindMissingRoutesAfterUploadAction);
    // }
}
