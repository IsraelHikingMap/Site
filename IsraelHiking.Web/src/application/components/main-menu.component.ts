import { Component, OnDestroy } from "@angular/core";
import { MatDialog, MatDialogConfig } from "@angular/material/dialog";
import { Subscription, Observable } from "rxjs";
import { Device } from "@ionic-native/device/ngx";
import { AppVersion } from "@ionic-native/app-version/ngx";
import { EmailComposer } from "@ionic-native/email-composer/ngx";

import { BaseMapComponent } from "./base-map.component";
import { ResourcesService } from "../services/resources.service";
import { AuthorizationService } from "../services/authorization.service";
import { RunningContextService } from "../services/running-context.service";
import { GeoLocationService } from "../services/geo-location.service";
import { LoggingService } from "../services/logging.service";
import { ToastService } from "../services/toast.service";
import { FileService } from "../services/file.service";
import { LayersService } from "../services/layers/layers.service";
import { SidebarService } from "../services/sidebar.service";
import { TermsOfServiceDialogComponent } from "./dialogs/terms-of-service-dialog.component";
import { TracesDialogComponent } from "./dialogs/traces-dialog.component";
import { SharesDialogComponent } from "./dialogs/shares-dialog.component";
import { ConfigurationDialogComponent } from "./dialogs/configuration-dialog.component";
import { LanguageDialogComponent } from "./dialogs/language-dialog.component";
import { FilesSharesDialogComponent } from "./dialogs/files-shares-dialog.component";
import { NgRedux, select } from "../reducers/infra/ng-redux.module";
import { SetUIComponentVisibilityAction } from "../reducers/ui-components.reducer";
import { SetAgreeToTermsAction } from "../reducers/user.reducer";
import { UserInfo, ApplicationState } from "../models/models";

@Component({
    selector: "main-menu",
    templateUrl: "./main-menu.component.html",
    styleUrls: ["./main-menu.component.scss"]
})
export class MainMenuComponent extends BaseMapComponent implements OnDestroy {

    private subscriptions: Subscription[];

    public userInfo: UserInfo;
    public searchVisible: boolean;
    public drawingVisible: boolean;
    public statisticsVisible: boolean;
    public isShowMore: boolean;

    @select((state: ApplicationState) => state.userState.userInfo)
    public userInfo$: Observable<UserInfo>;

    @select((state: ApplicationState) => state.uiComponentsState.searchVisible)
    public searchVisible$: Observable<boolean>;

    @select((state: ApplicationState) => state.uiComponentsState.drawingVisible)
    public drawingVisible$: Observable<boolean>;

    @select((state: ApplicationState) => state.uiComponentsState.statisticsVisible)
    public statisticsVisible$: Observable<boolean>;

    constructor(resources: ResourcesService,
                private readonly emailComposer: EmailComposer,
                private readonly device: Device,
                private readonly appVersion: AppVersion,
                private readonly authorizationService: AuthorizationService,
                private readonly dialog: MatDialog,
                private readonly runningContextService: RunningContextService,
                private readonly toastService: ToastService,
                private readonly fileService: FileService,
                private readonly geoLocationService: GeoLocationService,
                private readonly layersService: LayersService,
                private readonly sidebarService: SidebarService,
                private readonly loggingService: LoggingService,
                private readonly ngRedux: NgRedux<ApplicationState>) {
        super(resources);
        this.isShowMore = false;
        this.userInfo = null;
        this.subscriptions = [];
        this.subscriptions.push(this.userInfo$.subscribe(userInfo => this.userInfo = userInfo));
        this.subscriptions.push(this.searchVisible$.subscribe(v => this.searchVisible = v));
        this.subscriptions.push(this.drawingVisible$.subscribe(v => this.drawingVisible = v));
        this.subscriptions.push(this.statisticsVisible$.subscribe(v => this.statisticsVisible = v));
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
        return this.runningContextService.isCordova;
    }

    public isIFrame() {
        return this.runningContextService.isIFrame;
    }

    public toggleShowMore($event: Event) {
        this.isShowMore = !this.isShowMore;
        $event.stopPropagation();
    }

    public login() {
        if (!this.runningContextService.isOnline) {
            this.toastService.warning(this.resources.unableToLogin);
            return;
        }
        if (!this.ngRedux.getState().userState.agreedToTheTermsOfService) {
            let component = this.dialog.open(TermsOfServiceDialogComponent);
            component.afterClosed().subscribe((results: string) => {
                if (results === "true") {
                    this.ngRedux.dispatch(new SetAgreeToTermsAction({agree: true}));
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

    public selectSearch() {
        this.ngRedux.dispatch(new SetUIComponentVisibilityAction({
            component: "search",
            isVisible: !this.ngRedux.getState().uiComponentsState.searchVisible
        }));
    }

    public selectDrawing() {
        this.ngRedux.dispatch(new SetUIComponentVisibilityAction({
            component: "drawing",
            isVisible: !this.ngRedux.getState().uiComponentsState.drawingVisible
        }));
    }

    public selectStatistics() {
        this.ngRedux.dispatch(new SetUIComponentVisibilityAction({
            component: "statistics",
            isVisible: !this.ngRedux.getState().uiComponentsState.statisticsVisible
        }));
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
        if (!this.runningContextService.isCordova) {
            return;
        }
        this.toastService.info(this.resources.preparingDataForIssueReport);
        try {
            this.loggingService.info("--- Reporting an issue ---");
            let logs = await this.loggingService.getLog();
            let logBase64zipped = await this.fileService.compressTextToBase64Zip(logs);
            logs = await this.geoLocationService.getLog();
            let logBase64zippedGeoLocation = await this.fileService.compressTextToBase64Zip(logs);
            let userInfo = this.userInfo || {
                displayName: "non-registered user",
                id: "----"
            } as UserInfo;
            let infoString = ["----------------------------------------------------",
                `User ID: ${userInfo.id}`,
                `Username: ${userInfo.displayName}`,
                `Manufacture: ${this.device.manufacturer}`,
                `Model: ${this.device.model}`,
                `Platform: ${this.device.platform}`,
                `OS version: ${this.device.version}`,
                `App version: ${await this.appVersion.getVersionNumber()}`
            ].join("\n");
            this.toastService.info(this.resources.pleaseFillReport);
            this.emailComposer.open({
                to: ["israelhikingmap@gmail.com"],
                subject: "Issue reported by " + userInfo.displayName,
                body: this.resources.reportAnIssueInstructions + "\n\n" + infoString,
                attachments: [
                    "base64:log.zip//" + logBase64zipped,
                    "base64:geolocation-log.zip//" + logBase64zippedGeoLocation,
                ]
            });
        } catch (ex) {
            alert(`Ooopppss... Any chance you can take a screenshot and send it to israelhikingmap@gmail.com?` +
                `\nSend issue failed: ${ex.toString()}`);
        }
    }

    public openLanguage() {
        this.dialog.open(LanguageDialogComponent);
    }

    public isShowEditOsmButton() {
        return !this.runningContextService.isCordova &&
            !this.runningContextService.isMobile &&
            !this.runningContextService.isIFrame;
    }

    public getOsmAddress() {
        let poiState = this.ngRedux.getState().poiState;
        let baseLayerAddress = this.layersService.getSelectedBaseLayerAddressForOSM();
        if (poiState.isSidebarOpen &&
            poiState.selectedPointOfInterest != null &&
            poiState.selectedPointOfInterest.properties.poiSource.toLocaleLowerCase() === "osm") {
            return this.authorizationService.getEditElementOsmAddress(baseLayerAddress, poiState.selectedPointOfInterest.properties.identifier);
        }
        let currentLocation = this.ngRedux.getState().location;
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
}
