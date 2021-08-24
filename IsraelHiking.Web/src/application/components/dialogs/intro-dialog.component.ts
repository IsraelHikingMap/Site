import { Component } from "@angular/core";
import { MatDialog, MatDialogRef } from "@angular/material/dialog";

import { BaseMapComponent } from "../base-map.component";
import { NgRedux } from "../../reducers/infra/ng-redux.module";
import { ResourcesService } from "../../services/resources.service";
import { ApplicationState } from "../../models/models";
import { ConfigurationActions } from "application/reducers/configuration.reducer";

import { AnimationItem } from 'lottie-web';
import { AnimationOptions } from 'ngx-lottie';
@Component({
    selector: "intro-dialog",
    templateUrl: "./intro-dialog.component.html",
    styleUrls: ["./intro-dialog.component.scss"]
})
export class IntroDialogComponent extends BaseMapComponent {

    lottieLanguage: AnimationOptions = {
        path: '../../../content/lottie/dialog-language.json',
    };
    lottieMaps: AnimationOptions = {
        path: '../../../content/lottie/dialog-maps.json',
    };
    lottiePlan: AnimationOptions = {
        path: '../../../content/lottie/dialog-plan.json',
    };
    lottieMore: AnimationOptions = {
        path: '../../../content/lottie/dialog-more.json',
    };

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
