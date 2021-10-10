import { Component } from "@angular/core";
import { MatDialogRef } from "@angular/material/dialog";
import { Observable } from "rxjs";

import { BaseMapComponent } from "../base-map.component";
import { ResourcesService } from "../../services/resources.service";
import { RunningContextService } from "../../services/running-context.service";
import { ToastService } from "../../services/toast.service";
import { LoggingService } from "../../services/logging.service";
import { select, NgRedux } from "../../reducers/infra/ng-redux.module";
import { ConfigurationActions } from "../../reducers/configuration.reducer";
import type { ApplicationState } from "../../models/models";

@Component({
    selector: "configuration-dialog",
    templateUrl: "./configuration-dialog.component.html"
})
export class ConfigurationDialogComponent extends BaseMapComponent {

    @select((state: ApplicationState) => state.configuration.isBatteryOptimization)
    public isBatteryOptimization: Observable<boolean>;

    @select((state: ApplicationState) => state.configuration.isAutomaticRecordingUpload)
    public isAutomaticRecordingUpload: Observable<boolean>;

    // @select((state: ApplicationState) => state.configuration.isFindMissingRoutesAfterUpload)
    // public isFindMissingRoutesAfterUpload: Observable<boolean>;

    @select((state: ApplicationState) => state.configuration.isGotLostWarnings)
    public isGotLostWarnings: Observable<boolean>;

    constructor(resources: ResourcesService,
                private readonly dialogRef: MatDialogRef<ConfigurationDialogComponent>,
                private readonly runningContextService: RunningContextService,
                private readonly toastService: ToastService,
                private readonly logginService: LoggingService,
                private readonly ngRedux: NgRedux<ApplicationState>) {
        super(resources);
    }

    public isApp() {
        return this.runningContextService.isCordova;
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

    public toggleGotLostWarnings() {
        this.ngRedux.dispatch(ConfigurationActions.toggleIsGotLostWarningsAction);
    }

    public clearData() {
        this.toastService.confirm({
            type: "YesNo",
            message: this.resources.areYouSure,
            confirmAction: () => {
                this.logginService.info("************** RESET DATA WAS PRESSED **************");
                this.ngRedux.dispatch({ type: "RESET" });
                this.dialogRef.close();
            }
        });

    }
}
