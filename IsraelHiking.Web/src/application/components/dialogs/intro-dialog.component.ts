import { Component } from "@angular/core";
import { MatDialog, MatDialogRef } from "@angular/material/dialog";

import { BaseMapComponent } from "../base-map.component";
import { NgRedux } from "../../reducers/infra/ng-redux.module";
import { ResourcesService } from "../../services/resources.service";
import { ApplicationState } from "../../models/models";
import { ConfigurationActions } from "application/reducers/configuration.reducer";
@Component({
    selector: "intro-dialog",
    templateUrl: "./intro-dialog.component.html"
})
export class IntroDialogComponent extends BaseMapComponent {

    public step: number;

    constructor(resources: ResourcesService,
            private readonly dialogRef: MatDialogRef<IntroDialogComponent>,
            private readonly ngRedux: NgRedux<ApplicationState>) {
        super(resources);
        this.step = 0;
    }

    public static openDialog(dialog: MatDialog) {
        dialog.open(IntroDialogComponent, {
            maxWidth: "576px"
        });
    }

    public close() {
        this.ngRedux.dispatch(ConfigurationActions.stopShowIntroAction);
        this.dialogRef.close();
    }

}
