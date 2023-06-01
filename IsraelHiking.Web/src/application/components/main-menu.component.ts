import { Component, OnDestroy } from "@angular/core";
import { MatDialog, MatDialogConfig } from "@angular/material/dialog";
import { Subscription, Observable, timer } from "rxjs";
import { Device } from "@capacitor/device";
import { App } from "@capacitor/app";
import { SocialSharing } from "@awesome-cordova-plugins/social-sharing/ngx";
import { encode } from "base64-arraybuffer";
import { Store, Select } from "@ngxs/store";
import platform from "platform";

import { BaseMapComponent } from "./base-map.component";
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
import { TermsOfServiceDialogComponent } from "./dialogs/terms-of-service-dialog.component";
import { TracesDialogComponent } from "./dialogs/traces-dialog.component";
import { SharesDialogComponent } from "./dialogs/shares-dialog.component";
import { ConfigurationDialogComponent } from "./dialogs/configuration-dialog.component";
import { LanguageDialogComponent } from "./dialogs/language-dialog.component";
import { FilesSharesDialogComponent } from "./dialogs/files-shares-dialog.component";
import { SendReportDialogComponent } from "./dialogs/send-report-dialog.component";
import { SetUIComponentVisibilityAction } from "../reducers/ui-components.reducer";
import { SetAgreeToTermsAction } from "../reducers/user.reducer";
import type { UserInfo, ApplicationState } from "../models/models";

@Component({
    selector: "main-menu",
    templateUrl: "./main-menu.component.html",
    styleUrls: ["./main-menu.component.scss"]
})
export class MainMenuComponent extends BaseMapComponent implements OnDestroy {

    private subscriptions: Subscription[];

    public userInfo: UserInfo;
    public drawingVisible: boolean;
    public statisticsVisible: boolean;
    public isShowMore: boolean;

    @Select((state: ApplicationState) => state.userState.userInfo)
    public userInfo$: Observable<UserInfo>;

    @Select((state: ApplicationState) => state.uiComponentsState.drawingVisible)
    public drawingVisible$: Observable<boolean>;

    @Select((state: ApplicationState) => state.uiComponentsState.statisticsVisible)
    public statisticsVisible$: Observable<boolean>;

    constructor(resources: ResourcesService,
                private readonly socialSharing: SocialSharing,
                private readonly authorizationService: AuthorizationService,
                private readonly dialog: MatDialog,
                private readonly runningContextService: RunningContextService,
                private readonly toastService: ToastService,
                private readonly fileService: FileService,
                private readonly geoLocationService: GeoLocationService,
                private readonly layersService: LayersService,
                private readonly sidebarService: SidebarService,
                private readonly loggingService: LoggingService,
                private readonly hashService: HashService,
                private readonly purchaseService: PurchaseService,
                private readonly store: Store) {
        super(resources);
        this.isShowMore = false;
        this.userInfo = null;
        this.subscriptions = [];
        this.subscriptions.push(this.userInfo$.subscribe(userInfo => this.userInfo = userInfo));
        this.subscriptions.push(this.drawingVisible$.subscribe(v => this.drawingVisible = v));
        this.subscriptions.push(this.statisticsVisible$.subscribe(v => this.statisticsVisible = v));
        if (this.runningContextService.isCapacitor) {
            App.getInfo().then((info) => {
                this.loggingService.info(`App version: ${info.version}`);
            });
        }
    }

    public ngOnDestroy(): void {
        for (let subscription of this.subscriptions) {
            subscription.unsubscribe();
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

    public toggleShowMore($event: Event) {
        this.isShowMore = !this.isShowMore;
        $event.stopPropagation();
    }

    public getQueueText(): string {
        let queueLength = this.store.selectSnapshot((s: ApplicationState) => s.offlineState).uploadPoiQueue.length;
        return queueLength > 0 ? queueLength.toString() : "";
    }

    public login() {
        if (!this.runningContextService.isOnline) {
            this.toastService.warning(this.resources.unableToLogin);
            return;
        }
        if (!this.store.selectSnapshot((s: ApplicationState) => s.userState).agreedToTheTermsOfService) {
            let component = this.dialog.open(TermsOfServiceDialogComponent);
            component.afterClosed().subscribe((results: string) => {
                if (results === "true") {
                    this.store.dispatch(new SetAgreeToTermsAction(true));
                }
            });
        } else {
            this.authorizationService.login().then(() => { }, () => {
                this.toastService.warning(this.resources.unableToLogin);
            });
        }
    }

    public logout() {
        this.authorizationService.logout();
    }

    public selectDrawing() {
        this.store.dispatch(new SetUIComponentVisibilityAction(
            "drawing",
            !this.store.selectSnapshot((s: ApplicationState) => s.uiComponentsState).drawingVisible
        ));
    }

    public selectStatistics() {
        this.store.dispatch(new SetUIComponentVisibilityAction(
            "statistics",
            !this.store.selectSnapshot((s: ApplicationState) => s.uiComponentsState).statisticsVisible
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
        let layersState = this.store.selectSnapshot((s: ApplicationState) => s.layersState);
        let baseLayer = this.layersService.getSelectedBaseLayer();
        this.loggingService.info("--- Reporting an issue ---");
        let subscription  = timer(8000, 8000).subscribe(() => {
            this.toastService.info(this.resources.notYet);
        });
        let logs = await this.loggingService.getLog();
        let userInfo = this.userInfo || {
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
        let subject = "Issue reported by " + userInfo.displayName;
        try {
            if (!this.runningContextService.isCapacitor) {

                infoString += [
                    `Browser: ${platform.name} ${platform.version}`,
                    `OS: ${platform.os}`,
                    ""
                ].join("\n");
                await this.fileService.saveToZipFile(`support-${userInfo.id}.zip`, infoString + "\n" + logs);
                SendReportDialogComponent.openDialog(this.dialog, subject);
                return;
            }
            let info = await Device.getInfo();
            infoString += [
                `Manufacture: ${info.manufacturer}`,
                `Model: ${info.model}`,
                `Platform: ${info.platform}`,
                `OS version: ${info.osVersion}`,
                `App version: ${(await App.getInfo()).version}`
            ].join("\n");
            let geoLocationLogs = await this.geoLocationService.getLog();
            let logBase64zipped = await this.fileService.compressTextToBase64Zip([
                { name: "log.txt", text: logs},
                { name: "geolocation.txt", text: geoLocationLogs}
            ]);
            let infoBase64 = encode(await new Response(infoString).arrayBuffer());
            this.toastService.info(this.resources.pleaseFillReport);
            this.socialSharing.shareViaEmail(
                this.resources.reportAnIssueInstructions,
                subject,
                ["israelhikingmap@gmail.com"],
                null,
                null,
                [
                    `df:log.zip;data:application/zip;base64,${logBase64zipped}`,
                    `df:info-${userInfo.id}.txt;data:text/plain;base64,${infoBase64}`
                ]
            );
        } catch (ex) {
            alert("Ooopppss... Any chance you can take a screenshot and send it to israelhikingmap@gmail.com?" +
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
        let poiState = this.store.selectSnapshot((s: ApplicationState) => s.poiState);
        let baseLayerAddress = this.layersService.getSelectedBaseLayerAddressForOSM();
        if (poiState.isSidebarOpen &&
            poiState.selectedPointOfInterest != null &&
            poiState.selectedPointOfInterest.properties.poiSource.toLocaleLowerCase() === "osm") {
            return this.authorizationService.getEditElementOsmAddress(baseLayerAddress,
                poiState.selectedPointOfInterest.properties.identifier);
        }
        let currentLocation = this.store.selectSnapshot((s: ApplicationState) => s.locationState);
        return this.authorizationService.getEditOsmLocationAddress(baseLayerAddress,
            currentLocation.zoom + 1,
            currentLocation.latitude,
            currentLocation.longitude);
    }

    public openTraces() {
        this.dialog.open(TracesDialogComponent, { width: "480px" } as MatDialogConfig);
    }

    public openShares() {
        this.dialog.open(SharesDialogComponent, { width: "480px" } as MatDialogConfig);
    }

    public openConfigurationDialog() {
        this.dialog.open(ConfigurationDialogComponent, { width: "480px" } as MatDialogConfig);
    }

    public isShowOrderButton() {
        return this.runningContextService.isCapacitor &&
            (this.purchaseService.isPurchaseAvailable() ||
            this.purchaseService.isRenewAvailable());
    }

    public orderOfflineMaps() {
        let userInfo = this.store.selectSnapshot((s: ApplicationState) => s.userState).userInfo;
        if (userInfo == null || !userInfo.id) {
            this.toastService.warning(this.resources.loginRequired);
            return;
        }
        this.purchaseService.order();
        this.sidebarService.show("layers");
    }
}
