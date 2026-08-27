import { inject, Service } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { Store } from "@ngxs/store";

import { UseAppDialogComponent } from "../components/dialogs/use-app-dialog.component";
import { FacebookWarningDialogComponent } from "../components/dialogs/facebook-warning-dialog.component";
import { IntroDialogComponent } from "../components/dialogs/intro-dialog.component";
import { PrivacyDialogComponent } from "../components/dialogs/privacy-dialog.component";
import { LoggingService } from "./logging.service";
import { ScreenService } from "./screen.service";
import { ThemeService } from "./theme.service";
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
import { ApplicationUpdateService } from "./application-update.service";
import { LocationService } from "./location.service";
import { HashService } from "./hash.service";
import { AnalyticsService } from "./analytics.service";
import { SelectedRouteService } from "./selected-route.service";
import { CarService } from "./car.service";
import type { ApplicationState } from "../models";

@Service()
export class ApplicationInitializeService {

    private readonly dialog = inject(MatDialog);
    private readonly resources = inject(ResourcesService);
    private readonly loggingService = inject(LoggingService);
    private readonly screenService = inject(ScreenService);
    private readonly themeService = inject(ThemeService);
    private readonly databaseService = inject(DatabaseService);
    private readonly applicationExitService = inject(ApplicationExitService);
    private readonly openWithService = inject(OpenWithService);
    private readonly purchaseService = inject(PurchaseService);
    private readonly runningContextService = inject(RunningContextService);
    private readonly dragAndDropService = inject(DragAndDropService);
    private readonly poiService = inject(PoiService);
    private readonly deviceOrientationService = inject(DeviceOrientationService);
    private readonly recordedRouteService = inject(RecordedRouteService);
    private readonly tracesService = inject(TracesService);
    private readonly shareUrlsService = inject(ShareUrlsService);
    private readonly offlineFilesDownloadService = inject(OfflineFilesDownloadService);
    private readonly geoLocationService = inject(GeoLocationService);
    private readonly applicationUpdateService = inject(ApplicationUpdateService);
    private readonly locationService = inject(LocationService);
    private readonly hashService = inject(HashService);
    private readonly analyticsService = inject(AnalyticsService);
    private readonly selectedRouteService = inject(SelectedRouteService);
    private readonly carService = inject(CarService);
    private readonly store = inject(Store);

    /**
     * Opens whichever dialog the user is due, at most one of them.
     * The use app and privacy dialogs are both anchored to the bottom of the screen without a
     * backdrop, so opening two of them would leave one covering the other.
     */
    private openStartupDialog() {
        if (typeof window === "undefined" || this.runningContextService.isIFrame) {
            return;
        }
        const isShowOnboarding = this.store.selectSnapshot((s: ApplicationState) => s.configuration).isShowOnboarding;
        if (this.runningContextService.isCapacitor) {
            if (isShowOnboarding) {
                IntroDialogComponent.openDialog(this.dialog, this.runningContextService);
            }
            return;
        }
        if (isShowOnboarding) {
            PrivacyDialogComponent.openDialog(this.dialog, this.runningContextService, this.resources);
        } else if (this.runningContextService.isMobile) {
            if (this.runningContextService.isFacebook) {
                FacebookWarningDialogComponent.openDialog(this.dialog);
            } else {
                UseAppDialogComponent.openDialog(this.dialog);
            }
        }
    }

    public async initialize() {
        try {
            const timeToBootstrap = Math.round(performance.now());
            await this.loggingService.initialize();
            this.loggingService.info("---------------------------------------");
            this.loggingService.info(`Starting Mapeak Application Initialization, ${timeToBootstrap} ms after the page started loading`);
            await this.databaseService.initialize();
            this.analyticsService.initialize();
            this.screenService.initialize();
            this.themeService.initialize();
            await this.resources.initialize();
            this.applicationExitService.initialize();
            this.openWithService.initialize();
            await this.purchaseService.initialize();
            this.geoLocationService.initialize();
            this.hashService.initialize();
            this.dragAndDropService.initialize();
            this.carService.initialize();
            this.openStartupDialog();
            this.selectedRouteService.initialize();
            this.poiService.initialize(); // do not wait for it to complete
            this.recordedRouteService.initialize();
            this.deviceOrientationService.initialize();
            this.tracesService.initialize(); // no need to wait for it to complete
            this.shareUrlsService.initialize(); // no need to wait for it to complete
            this.offlineFilesDownloadService.initialize(); // no need to wait for it to complete
            this.locationService.initialize();
            this.applicationUpdateService.initialize(); // no need to wait for it to complete
            this.loggingService.info(`Finished Mapeak Application Initialization, ${Math.round(performance.now())} ms after the page started loading`);
        } catch (ex) {
            if (this.runningContextService.isIFrame) {
                return;
            }
            console.error("[Init Error]", ex);
            if (typeof alert === "undefined") {
                return;
            }
            if ((ex as Error).message.indexOf("A mutation operation was attempted on a database that did not allow mutations") !== -1) {
                alert("Sorry, this site does not support running FireFox in private mode...");
            } else {
                alert("Ooopppss... We have encountered an unexpected failure. Please try again.\n" +
                    "If that does not help, please take a screenshot and send it to support@mapeak.com\n" +
                    `Init failed: ${(ex as Error).message}`);
            }
            this.loggingService.error(`Failed Mapeak Application Initialization: ${(ex as Error).message}`);
        }
    }
}
