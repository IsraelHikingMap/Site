import { Component, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { NgIf, NgClass, AsyncPipe } from "@angular/common";
import { MatButton } from "@angular/material/button";
import { MatMenuTrigger, MatMenu, MatMenuContent, MatMenuItem } from "@angular/material/menu";
import { Dir } from "@angular/cdk/bidi";
import { MatDialog } from "@angular/material/dialog";
import { Angulartics2OnModule } from "angulartics2";
import { timer } from "rxjs";
import { Device } from "@capacitor/device";
import { App } from "@capacitor/app";
import { encode } from "base64-arraybuffer";
import { Store } from "@ngxs/store";
import { EmailComposer } from "capacitor-email-composer"
import platform from "platform";

import { OfflineImagePipe } from "../pipes/offline-image.pipe";
import { ResourcesService } from "../services/resources.service";
import { AuthorizationService } from "../services/authorization.service";
import { RunningContextService } from "../services/running-context.service";
import { LoggingService } from "../services/logging.service";
import { ToastService } from "../services/toast.service";
import { FileService } from "../services/file.service";
import { GeoLocationService } from "../services/geo-location.service";
import { LayersService } from "../services/layers.service";
import { SidebarService } from "../services/sidebar.service";
import { HashService } from "../services/hash.service";
import { PurchaseService } from "../services/purchase.service";
import { OsmAddressesService } from "../services/osm-addresses.service";
import { TermsOfServiceDialogComponent } from "./dialogs/terms-of-service-dialog.component";
import { TracesDialogComponent } from "./dialogs/traces-dialog.component";
import { SharesDialogComponent } from "./dialogs/shares-dialog.component";
import { ConfigurationDialogComponent } from "./dialogs/configuration-dialog.component";
import { LanguageDialogComponent } from "./dialogs/language-dialog.component";
import { FilesSharesDialogComponent } from "./dialogs/files-shares-dialog.component";
import { SendReportDialogComponent } from "./dialogs/send-report-dialog.component";
import { SetUIComponentVisibilityAction } from "../reducers/ui-components.reducer";
import { SetAgreeToTermsAction } from "../reducers/user.reducer";
import type { UserInfo, ApplicationState } from "../models";

@Component({
    selector: "main-menu",
    templateUrl: "./main-menu.component.html",
    styleUrls: ["./main-menu.component.scss"],
    imports: [NgIf, MatButton, Angulartics2OnModule, MatMenuTrigger, NgClass, MatMenu, MatMenuContent, Dir, MatMenuItem, AsyncPipe, OfflineImagePipe]
})
export class MainMenuComponent {

    public userInfo: UserInfo = null;
    public drawingVisible: boolean = false;
    public statisticsVisible: boolean = false;

    public readonly resources = inject(ResourcesService);

    private readonly authorizationService = inject(AuthorizationService);
    private readonly osmAddressesService = inject(OsmAddressesService);
    private readonly dialog = inject(MatDialog);
    private readonly runningContextService = inject(RunningContextService);
    private readonly toastService = inject(ToastService);
    private readonly fileService = inject(FileService);
    private readonly geoLocationService = inject(GeoLocationService);
    private readonly layersService = inject(LayersService);
    private readonly sidebarService = inject(SidebarService);
    private readonly loggingService = inject(LoggingService);
    private readonly hashService = inject(HashService);
    private readonly purchaseService = inject(PurchaseService);
    private readonly store = inject(Store);
    
    constructor() {
        this.store.select((state: ApplicationState) => state.userState.userInfo).pipe(takeUntilDestroyed()).subscribe(userInfo => this.userInfo = userInfo);
        this.store.select((state: ApplicationState) => state.uiComponentsState.drawingVisible).pipe(takeUntilDestroyed()).subscribe(v => this.drawingVisible = v);
        this.store.select((state: ApplicationState) => state.uiComponentsState.statisticsVisible).pipe(takeUntilDestroyed()).subscribe(v => this.statisticsVisible = v);
        if (this.runningContextService.isCapacitor) {
            App.getInfo().then((info) => {
                this.loggingService.info(`App version: ${info.version}`);
            });
        }
    }

    public isLoggedIn() {
        return this.userInfo != null;
    }

    public isOffline() {
        return !this.runningContextService.isOnline;
    }

    public isApp() {
        return this.runningContextService.isCapacitor;
    }

    public isIFrame() {
        return this.runningContextService.isIFrame;
    }

    public getQueueText(): string {
        const queueLength = this.store.selectSnapshot((s: ApplicationState) => s.offlineState).uploadPoiQueue.length;
        return queueLength > 0 ? queueLength.toString() : "";
    }

    public login() {
        if (!this.runningContextService.isOnline) {
            this.toastService.warning(this.resources.unableToLogin);
            return;
        }
        if (!this.store.selectSnapshot((s: ApplicationState) => s.userState).agreedToTheTermsOfService) {
            const component = this.dialog.open(TermsOfServiceDialogComponent, { width: "480px"});
            component.afterClosed().subscribe((results: string) => {
                if (results === "true") {
                    this.store.dispatch(new SetAgreeToTermsAction(true));
                }
            });
        } else {
            this.authorizationService.login().then(() => { }, (ex) => {
                this.toastService.warning(this.resources.unableToLogin);
                this.loggingService.error(`[Main Menu] Unable to login: ${ex.message}`);
            });
        }
    }

    public logout() {
        this.authorizationService.logout();
    }

    public selectDrawing() {
        this.store.dispatch(new SetUIComponentVisibilityAction(
            "drawing",
            !this.drawingVisible
        ));
    }

    public selectStatistics() {
        this.store.dispatch(new SetUIComponentVisibilityAction(
            "statistics",
            !this.statisticsVisible
        ));
    }

    public selectLayers() {
        this.sidebarService.toggle("layers");
    }

    public selectSharesAndFiles() {
        this.dialog.open(FilesSharesDialogComponent);
    }

    public selectLegendAndAbout() {
        this.sidebarService.toggle("info");
    }

    public async reportAnIssue() {
        this.toastService.info(this.resources.preparingDataForIssueReport);
        const layersState = this.store.selectSnapshot((s: ApplicationState) => s.layersState);
        const baseLayer = this.layersService.getSelectedBaseLayer();
        this.loggingService.info("--- Reporting an issue ---");
        const subscription  = timer(8000, 8000).subscribe(() => {
            this.toastService.info(this.resources.notYet);
        });
        const logs = await this.loggingService.getLog();
        const userInfo = this.userInfo || {
            displayName: "non-registered user",
            id: "----"
        } as UserInfo;
        let infoString = [
            `User ID: ${userInfo.id}`,
            `Username: ${userInfo.displayName}`,
            `Map Location: ${this.hashService.getMapAddress()}`,
            `Baselayer: ${baseLayer.key}, ${baseLayer.address}`,
            `Visible overlays: ${JSON.stringify(layersState.overlays.filter(o => o.visible))}`,
            ""
        ].join("\n");
        const subject = "Issue reported by " + userInfo.displayName;
        try {
            if (!this.runningContextService.isCapacitor) {

                infoString += [
                    `Browser: ${platform.name} ${platform.version}`,
                    `OS: ${platform.os}`,
                    ""
                ].join("\n");
                await this.fileService.saveLogToZipFile(`support-${userInfo.id}.zip`, infoString + "\n" + logs);
                SendReportDialogComponent.openDialog(this.dialog, subject);
                return;
            }
            const info = await Device.getInfo();
            infoString += [
                `Manufacture: ${info.manufacturer}`,
                `Model: ${info.model}`,
                `Platform: ${info.platform}`,
                `OS version: ${info.osVersion}`,
                `App version: ${(await App.getInfo()).version}`,
                `Has Subscription: ${!this.isShowOrderButton()}`
            ].join("\n");
            const logFileUri = await this.fileService.storeFileToCache("log.txt", logs);
            const infoBase64 = encode(await new Response(infoString).arrayBuffer());
            this.toastService.info(this.resources.pleaseFillReport);
            
            EmailComposer.open({
                to: ["israelhiking@osm.org.il"],
                subject: subject,
                body: this.resources.reportAnIssueInstructions,
                attachments: [{
                    type: "absolute",
                    name: "log.txt",
                    path: logFileUri
                }, {
                    type: "base64",
                    name: `info-${userInfo.id}.txt`,
                    path: infoBase64
                }]
            });
        } catch (ex) {
            alert("Ooopppss... Any chance you can take a screenshot and send it to israelhiking@osm.org.il?" +
                `\nSend issue failed: ${ex.toString()}`);
        } finally {
            subscription.unsubscribe();
        }
    }

    public openLanguage() {
        LanguageDialogComponent.openDialog(this.dialog);
    }

    public isShowEditOsmButton() {
        return !this.runningContextService.isCapacitor &&
            !this.runningContextService.isMobile &&
            !this.runningContextService.isIFrame;
    }

    public getOsmAddress() {
        const poiState = this.store.selectSnapshot((s: ApplicationState) => s.poiState);
        const baseLayerAddress = this.layersService.getSelectedBaseLayerAddressForOSM();
        if (poiState.selectedPointOfInterest != null &&
            poiState.selectedPointOfInterest.properties.poiSource.toLocaleLowerCase() === "osm") {
            return this.osmAddressesService.getEditElementOsmAddress(baseLayerAddress,
                poiState.selectedPointOfInterest.properties.identifier);
        }
        const currentLocation = this.store.selectSnapshot((s: ApplicationState) => s.locationState);
        return this.osmAddressesService.getEditOsmLocationAddress(baseLayerAddress,
            currentLocation.zoom + 1,
            currentLocation.latitude,
            currentLocation.longitude);
    }

    public openTraces() {
        this.dialog.open(TracesDialogComponent, { width: "480px", data: [] });
    }

    public openShares() {
        this.dialog.open(SharesDialogComponent, { width: "480px" });
    }

    public openConfigurationDialog() {
        this.dialog.open(ConfigurationDialogComponent, { width: "480px" });
    }

    public isShowOrderButton() {
        return this.runningContextService.isCapacitor &&
            (this.purchaseService.isPurchaseAvailable() ||
            this.purchaseService.isRenewAvailable());
    }

    public orderOfflineMaps() {
        const userInfo = this.store.selectSnapshot((s: ApplicationState) => s.userState).userInfo;
        if (userInfo == null || !userInfo.id) {
            this.toastService.warning(this.resources.loginRequired);
            return;
        }
        this.purchaseService.order();
        this.sidebarService.show("layers");
    }
}
