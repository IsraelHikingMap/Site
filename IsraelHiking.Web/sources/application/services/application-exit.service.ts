import { Injectable, NgZone } from "@angular/core";
import { NgRedux } from "@angular-redux/store";

import { RunningContextService } from "./running-context.service";
import { ResourcesService } from "./resources.service";
import { LoggingService } from "./logging.service";
import { DatabaseService } from "./database.service";
import { ToastService } from "./toast.service";
import { MatDialog } from "@angular/material";
import { SidebarService } from "./sidebar.service";
import { SetSidebarAction } from "../reducres/poi.reducer";
import { SelectedRouteService } from "./layers/routelayers/selected-route.service";
import { GeoLocationService } from "./geo-location.service";
import { ApplicationState } from "../models/models";

declare var navigator: Navigator;

declare type ExitState = "None" | "FirstClick" | "SecondClick";

interface Navigator {
    app: any;
}

@Injectable()
export class ApplicationExitService {
    private state: ExitState;

    constructor(private readonly resources: ResourcesService,
                private readonly matDialog: MatDialog,
                private readonly sidebarService: SidebarService,
                private readonly ngZone: NgZone,
                private readonly databaseService: DatabaseService,
                private readonly runningContext: RunningContextService,
                private readonly selectedRouteService: SelectedRouteService,
                private readonly geoLocationService: GeoLocationService,
                private readonly ngRedux: NgRedux<ApplicationState>,
                private readonly loggingService: LoggingService,
                private readonly toastService: ToastService) {

        this.state = "None";
    }

    public initialize() {
        if (!this.runningContext.isCordova || !navigator.app) {
            return;
        }
        document.addEventListener("backbutton", async (e) => {
            e.preventDefault();
            await this.ngZone.run(async () => {
                if (this.matDialog.openDialogs.length > 0) {
                    this.matDialog.closeAll();
                    return;
                }
                if (this.sidebarService.isVisible) {
                    this.sidebarService.hide();
                    return;
                }
                if (this.ngRedux.getState().poiState.isSidebarOpen) {
                    this.ngRedux.dispatch(new SetSidebarAction({
                        isOpen: false
                    }));
                    return;
                }
                if (this.selectedRouteService.getRecordingRoute() != null) {
                    this.toastService.confirm({
                        message: this.resources.areYouSureYouWantToStopRecording,
                        type: "YesNo",
                        confirmAction: () => {
                            this.loggingService.info("Stop recording using the back button");
                            this.selectedRouteService.stopRecording();
                        },
                        declineAction: () => { }
                    });
                    return;
                }
                setTimeout(() => { this.state = "None"; }, 5000);
                if (this.state === "FirstClick") {
                    this.state = "SecondClick";
                    this.toastService.info(this.resources.wrappingThingsUp);
                    this.loggingService.debug("Starting IHM Application Exit");
                    await this.databaseService.close();
                    this.geoLocationService.disable();
                    this.loggingService.debug("Finished IHM Application Exit");
                    await this.loggingService.close();
                    navigator.app.exitApp();
                } else if (this.state === "None") {
                    this.state = "FirstClick";
                    this.toastService.info(this.resources.clickBackAgainToCloseTheApp);
                    // ionic webview doesn't change the internal addressbar...
                    // history.back();
                }
            });
        }, false);
    }
}
