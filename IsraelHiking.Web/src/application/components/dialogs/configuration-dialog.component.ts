import { Component, OnDestroy } from "@angular/core";
import { MatDialogRef } from "@angular/material/dialog";
import { Subscription } from "rxjs";
import { Store } from "@ngxs/store";

import { BaseMapComponent } from "../base-map.component";
import { ResourcesService } from "../../services/resources.service";
import { RunningContextService } from "../../services/running-context.service";
import { ToastService } from "../../services/toast.service";
import { LoggingService } from "../../services/logging.service";
import { initialState } from "../../reducers/initial-state";
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
export class ConfigurationDialogComponent extends BaseMapComponent implements OnDestroy {

    private subscriptions: Subscription[];

    public batteryOptimizationType: BatteryOptimizationType;
    public isAutomaticRecordingUpload: boolean;
    public isGotLostWarnings: boolean;

    constructor(resources: ResourcesService,
        private readonly dialogRef: MatDialogRef<ConfigurationDialogComponent>,
        private readonly runningContextService: RunningContextService,
        private readonly toastService: ToastService,
        private readonly logginService: LoggingService,
        private readonly store: Store) {
        super(resources);
        this.subscriptions = [];
        this.subscriptions.push(this.store.select((state: ApplicationState) => state.configuration.batteryOptimizationType).subscribe((batteryOptimizationType) => {
            this.batteryOptimizationType = batteryOptimizationType;
        }));
        this.subscriptions.push(this.store.select((state: ApplicationState) => state.configuration.isAutomaticRecordingUpload).subscribe((isAutomaticRecordingUpload) => {
            this.isAutomaticRecordingUpload = isAutomaticRecordingUpload;
        }));
        this.subscriptions.push(this.store.select((state: ApplicationState) => state.configuration.isGotLostWarnings).subscribe((isGotLostWarnings) => {
            this.isGotLostWarnings = isGotLostWarnings;
        }));
    }

    public ngOnDestroy() {
        for (const subscription of this.subscriptions) {
            subscription.unsubscribe();
        }
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
