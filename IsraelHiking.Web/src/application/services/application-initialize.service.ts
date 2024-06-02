import { Injectable } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { Store } from "@ngxs/store";

import { UseAppDialogComponent } from "../components/dialogs/use-app-dialog.component";
import { FacebookWarningDialogComponent } from "../components/dialogs/facebook-warning-dialog.component";
import { IntroDialogComponent } from "../components/dialogs/intro-dialog.component";
import { LoggingService } from "./logging.service";
import { ScreenService } from "./screen.service";
import { DatabaseService } from "./database.service";
import { ApplicationExitService } from "./application-exit.service";
import { OpenWithService } from "./open-with.service";
import { PurchaseService } from "./purchase.service";
import { RunningContextService } from "./running-context.service";
import { DragAndDropService } from "./drag-and-drop.service";
import { PoiService } from "./poi.service";
import { RecordedRouteService } from "./recorded-route.service";
import { DeviceOrientationService } from "./device-orientation.service";
import { TracesService } from "./traces.service";
import { OfflineFilesDownloadService } from "./offline-files-download.service";
import { ResourcesService } from "./resources.service";
import { ShareUrlsService } from "./share-urls.service";
import { GeoLocationService } from "./geo-location.service";
import { OverpassTurboService } from "./overpass-turbo.service";
import { AuthorizationService } from "./authorization.service";
import { ToastService } from "./toast.service";
import type { ApplicationState } from "../models/models";

@Injectable()
export class ApplicationInitializeService {
    constructor(private readonly dialog: MatDialog,
                private readonly resources: ResourcesService,
                private readonly loggingService: LoggingService,
                private readonly screenService: ScreenService,
                private readonly databaseService: DatabaseService,
                private readonly applicationExitService: ApplicationExitService,
                private readonly openWithService: OpenWithService,
                private readonly purchaseService: PurchaseService,
                private readonly runningContextService: RunningContextService,
                private readonly dragAndDropService: DragAndDropService,
                private readonly poiService: PoiService,
                private readonly deviceOrientationService: DeviceOrientationService,
                private readonly recordedRouteService: RecordedRouteService,
                private readonly tracesService: TracesService,
                private readonly shareUrlsService: ShareUrlsService,
                private readonly offlineFilesDownloadService: OfflineFilesDownloadService,
                private readonly geoLocationService: GeoLocationService,
                private readonly overpassTurboService: OverpassTurboService,
                private readonly authorizationService: AuthorizationService,
                private readonly toastService: ToastService,
                private readonly store: Store
    ) {
    }

    public async initialize() {
        try {
            await this.loggingService.initialize();
            await this.loggingService.info("---------------------------------------");
            await this.loggingService.info("Starting IHM Application Initialization");
            await this.databaseService.initialize();
            this.overpassTurboService.initialize();
            this.screenService.initialize();
            await this.resources.initialize();
            this.applicationExitService.initialize();
            this.openWithService.initialize();
            await this.purchaseService.initialize();
            this.geoLocationService.initialize();
            this.dragAndDropService.initialize();
            if (this.runningContextService.isMobile
                && !this.runningContextService.isCapacitor
                && !this.runningContextService.isIFrame) {
                    if (this.runningContextService.isFacebook) {
                        FacebookWarningDialogComponent.openDialog(this.dialog);
                    } else {
                        UseAppDialogComponent.openDialog(this.dialog);
                    }
            } else if (!this.runningContextService.isIFrame
                && this.store.selectSnapshot((s: ApplicationState) => s.configuration).isShowIntro) {
                    IntroDialogComponent.openDialog(this.dialog, this.runningContextService);
            }
            // HM TODO: remove this at 01.2025
            if (this.store.selectSnapshot((s: ApplicationState) => s.userState).token?.includes(";")) {
                this.toastService.confirm({
                    type: "OkCancel",
                    message: this.resources.loginTokenExpiredPleaseLoginAgain,
                    confirmAction: () => {
                        this.authorizationService.logout();
                        this.authorizationService.login();
                    },
                    declineAction: () => { }
                });
            }
            this.poiService.initialize(); // do not wait for it to complete
            this.recordedRouteService.initialize();
            this.deviceOrientationService.initialize();
            this.tracesService.initialize(); // no need to wait for it to complete
            this.shareUrlsService.initialize(); // no need to wait for it to complete
            this.offlineFilesDownloadService.initialize(); // no need to wait for it to complete
            await this.loggingService.info("Finished IHM Application Initialization");
        } catch (ex) {
            if (this.runningContextService.isIFrame) {
                return;
            }
            if ((ex as Error).message.indexOf("A mutation operation was attempted on a database that did not allow mutations") !== -1) {
                alert("Sorry, this site does not support running FireFox in private mode...");
            } else {
                alert("Ooopppss... We have encountered an unexpected failure. Please try again.\n" +
                      "If that does not help, please take a screenshot and send it to israelhikingmap@gmail.com\n" +
                      `Init failed: ${(ex as Error).message}`);
            }
            this.loggingService.error(`Failed IHM Application Initialization: ${(ex as Error).message}`);
        }
    }
}
