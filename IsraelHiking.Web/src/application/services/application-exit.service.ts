import { Injectable, NgZone } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { NgRedux } from "@angular-redux2/store";
import { App } from "@capacitor/app";

import { RunningContextService } from "./running-context.service";
import { ResourcesService } from "./resources.service";
import { LoggingService } from "./logging.service";
import { DatabaseService } from "./database.service";
import { ToastService } from "./toast.service";
import { SidebarService } from "./sidebar.service";
import { GeoLocationService } from "./geo-location.service";
import { RecordedRouteService } from "./recorded-route.service";
import { ImageGalleryService } from "./image-gallery.service";
import { PointsOfInterestReducer } from "../reducers/poi.reducer";
import type { ApplicationState } from "../models/models";

declare let navigator: Navigator;

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
                private readonly recordingRouteService: RecordedRouteService,
                private readonly geoLocationService: GeoLocationService,
                private readonly imageGalleryService: ImageGalleryService,
                private readonly ngRedux: NgRedux<ApplicationState>,
                private readonly loggingService: LoggingService,
                private readonly toastService: ToastService) {

        this.state = "None";
    }

    public initialize() {
        if (!this.runningContext.isCapacitor) {
            return;
        }
        App.addListener("backButton", async () => {
            await this.ngZone.run(async () => {
                if (this.imageGalleryService.isOpen()) {
                    this.imageGalleryService.close();
                    return;
                }
                if (this.matDialog.openDialogs.length > 0) {
                    this.matDialog.closeAll();
                    return;
                }
                if (this.sidebarService.isVisible) {
                    this.sidebarService.hide();
                    return;
                }
                if (this.ngRedux.getState().poiState.isSidebarOpen) {
                    this.ngRedux.dispatch(PointsOfInterestReducer.actions.setSidebar({
                        isOpen: false
                    }));
                    return;
                }
                if (this.recordingRouteService.isRecording()) {
                    this.toastService.confirm({
                        message: this.resources.areYouSureYouWantToStopRecording,
                        type: "YesNo",
                        confirmAction: () => {
                            this.loggingService.info("Stop recording using the back button");
                            this.recordingRouteService.stopRecording();
                        },
                    });
                    return;
                }
                setTimeout(() => { this.state = "None"; }, 5000);
                if (this.state === "FirstClick") {
                    this.state = "SecondClick";
                    this.exitApp();
                } else if (this.state === "None") {
                    this.state = "FirstClick";
                    this.toastService.info(this.resources.clickBackAgainToCloseTheApp);
                }
            });
        });
    }

    private async exitApp() {
        this.toastService.info(this.resources.wrappingThingsUp);
        this.loggingService.info("Starting IHM Application Exit");
        await this.geoLocationService.uninitialize();
        await this.databaseService.uninitialize();
        this.loggingService.info("Finished IHM Application Exit");
        App.exitApp();
    }
}
