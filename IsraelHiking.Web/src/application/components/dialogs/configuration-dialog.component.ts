import { Component } from "@angular/core";
import { MatDialogRef } from "@angular/material/dialog";
import { Observable } from "rxjs";
import { Store, Select } from "@ngxs/store";

import { BaseMapComponent } from "../base-map.component";
import { ResourcesService } from "../../services/resources.service";
import { RunningContextService } from "../../services/running-context.service";
import { ToastService } from "../../services/toast.service";
import { LoggingService } from "../../services/logging.service";
import { initialState } from "application/reducers/initial-state";
import {
    SetBatteryOptimizationTypeAction,
    ToggleAutomaticRecordingUploadAction,
    ToggleGotLostWarningsAction
} from "../../reducers/configuration.reducer";
import type { ApplicationState, BatteryOptimizationType } from "../../models/models";

@Component({
    selector: "configuration-dialog",
    templateUrl: "./configuration-dialog.component.html"
})
export class ConfigurationDialogComponent extends BaseMapComponent {

    @Select((state: ApplicationState) => state.configuration.batteryOptimizationType)
    public batteryOptimizationType: Observable<BatteryOptimizationType>;

    @Select((state: ApplicationState) => state.configuration.isAutomaticRecordingUpload)
    public isAutomaticRecordingUpload: Observable<boolean>;

    @Select((state: ApplicationState) => state.configuration.isGotLostWarnings)
    public isGotLostWarnings: Observable<boolean>;

    constructor(resources: ResourcesService,
        private readonly dialogRef: MatDialogRef<ConfigurationDialogComponent>,
        private readonly runningContextService: RunningContextService,
        private readonly toastService: ToastService,
        private readonly logginService: LoggingService,
        private readonly store: Store) {
        super(resources);
    }

    public isApp() {
        return this.runningContextService.isCapacitor;
    }

    public toggleAutomaticRecordingUpload() {
        this.store.dispatch(new ToggleAutomaticRecordingUploadAction());
    }

    public setBatteryOptimizationType(batteryOptimizationType: BatteryOptimizationType) {
        this.store.dispatch(new SetBatteryOptimizationTypeAction(batteryOptimizationType));
    }

    public toggleGotLostWarnings() {
        this.store.dispatch(new ToggleGotLostWarningsAction());
    }

    public clearData() {
        this.toastService.confirm({
            type: "YesNo",
            message: this.resources.areYouSure,
            confirmAction: () => {
                this.logginService.info("************** RESET DATA WAS PRESSED **************");
                this.store.reset(initialState);
                this.dialogRef.close();
            }
        });

    }
}
