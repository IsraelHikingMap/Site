import { inject, Injectable, NgZone } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { App } from "@capacitor/app";

import { RunningContextService } from "./running-context.service";
import { ResourcesService } from "./resources.service";
import { LoggingService } from "./logging.service";
import { DatabaseService } from "./database.service";
import { ToastService } from "./toast.service";
import { SidebarService } from "./sidebar.service";
import { LocationService } from "./location.service";
import { RecordedRouteService } from "./recorded-route.service";
import { ImageGalleryService } from "./image-gallery.service";

type ExitState = "None" | "FirstClick" | "SecondClick";

@Injectable()
export class ApplicationExitService {
    private state: ExitState = "None";
    private readonly resources = inject(ResourcesService);
    private readonly matDialog = inject(MatDialog);
    private readonly sidebarService = inject(SidebarService);
    private readonly ngZone = inject(NgZone);
    private readonly databaseService = inject(DatabaseService);
    private readonly runningContextService = inject(RunningContextService);
    private readonly recordingRouteService = inject(RecordedRouteService);
    private readonly locationService = inject(LocationService);
    private readonly imageGalleryService = inject(ImageGalleryService);
    private readonly loggingService = inject(LoggingService);
    private readonly toastService = inject(ToastService);

    public initialize() {
        if (!this.runningContextService.isCapacitor) {
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
                if (this.sidebarService.isSidebarOpen()) {
                    this.sidebarService.hide();
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
        this.loggingService.info("Starting Mapeak Application Exit");
        await this.locationService.uninitialize();
        await this.databaseService.uninitialize();
        this.loggingService.info("Finished Mapeak Application Exit");
        App.exitApp();
    }
}
