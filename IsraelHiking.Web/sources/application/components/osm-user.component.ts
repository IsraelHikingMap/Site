import { Component, OnDestroy } from "@angular/core";
import { MatDialog, MatDialogConfig } from "@angular/material";
import { select } from "@angular-redux/store";
import { LocalStorage } from "ngx-store";
import { Observable, Subscription } from "rxjs";
import { EmailComposer } from "@ionic-native/email-composer/ngx";
import { Device } from "@ionic-native/device/ngx";
import { AppVersion } from '@ionic-native/app-version/ngx';

import { ResourcesService } from "../services/resources.service";
import { AuthorizationService } from "../services/authorization.service";
import { ToastService } from "../services/toast.service";
import { LoggingService } from "../services/logging.service";
import { RunningContextService } from "../services/running-context.service";
import { FileService } from "../services/file.service";
import { GeoLocationService } from "../services/geo-location.service";
import { BaseMapComponent } from "./base-map.component";
import { TracesDialogComponent } from "./dialogs/traces-dialog.component";
import { SharesDialogComponent } from "./dialogs/shares-dialog.component";
import { TermsOfServiceDialogComponent } from "./dialogs/terms-of-service-dialog.component";
import { ConfigurationDialogComponent } from "./dialogs/configuration-dialog.component";
import { UserInfo, ApplicationState } from "../models/models";

interface IRank {
    name: string;
    points: number;
}

@Component({
    selector: "osm-user",
    templateUrl: "./osm-user.component.html",
    styleUrls: ["./osm-user.component.scss"]
})
export class OsmUserComponent extends BaseMapComponent implements OnDestroy {

    private ranks: IRank[];
    private subscription: Subscription;

    public userInfo: UserInfo;

    @select((state: ApplicationState) => state.userState.userInfo)
    public userInfo$: Observable<UserInfo>;

    @LocalStorage()
    public agreedToTheTermsOfService = false;

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
                private readonly loggingService: LoggingService) {
        super(resources);
        this.initializeRanks();
        resources.languageChanged.subscribe(() => this.initializeRanks());
        this.subscription = this.userInfo$.subscribe(userInfo => this.userInfo = userInfo);
    }

    public ngOnDestroy(): void {
        this.subscription.unsubscribe();
    }

    private initializeRanks() {
        this.ranks = [
            {
                name: this.resources.junior,
                points: 10
            },
            {
                name: this.resources.partner,
                points: 100
            },
            {
                name: this.resources.master,
                points: 1000
            },
            {
                name: this.resources.guru,
                points: Infinity
            }
        ];
    }

    public isLoggedIn() {
        return this.authorizationService.isLoggedIn();
    }

    public login() {
        if (!this.runningContextService.isOnline) {
            this.toastService.warning(this.resources.unableToLogin);
            return;
        }
        if (!this.agreedToTheTermsOfService) {
            let component = this.dialog.open(TermsOfServiceDialogComponent);
            component.afterClosed().subscribe((results: string) => {
                if (results === "true") {
                    this.agreedToTheTermsOfService = true;
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

    public openTraces() {
        this.dialog.open(TracesDialogComponent, { width: "480px" } as MatDialogConfig);
    }

    public openShares() {
        this.dialog.open(SharesDialogComponent, { width: "480px" } as MatDialogConfig);
    }

    public openConfigurationDialog() {
        this.dialog.open(ConfigurationDialogComponent, { width: "480px" } as MatDialogConfig);
    }

    public getRank() {
        let rankIndex = 0;
        while (this.authorizationService.getUserInfo().changeSets > this.ranks[rankIndex].points) {
            rankIndex++;
        }
        return this.ranks[rankIndex];
    }

    public getRankPercentage() {
        let rank = this.getRank();
        if (rank === this.ranks[this.ranks.length - 1]) {
            return 100;
        }
        return ((this.authorizationService.getUserInfo().changeSets / rank.points) * 100);
    }

    public getProgressbarType() {
        if (this.getRankPercentage() < 5) {
            return "warn";
        }
        if (this.getRankPercentage() < 30) {
            return "accent";
        }
        return "primary";
    }

    public isApp() {
        return this.runningContextService.isCordova;
    }

    public async reportAnIssue() {
        if (!this.runningContextService.isCordova) {
            return;
        }
        this.toastService.info(this.resources.preparingDataForIssueReport);
        try {
            let logs = await this.loggingService.getLog();
            let logBase64zipped = await this.fileService.zipAndStoreFile(logs);
            logs = await this.geoLocationService.getLog();
            let logBase64zippedGeoLocation = await this.fileService.zipAndStoreFile(logs);
            let infoString = ["----------------------------------------------------",
                `User ID: ${this.userInfo.id}`,
                `Username: ${this.userInfo.displayName}`,
                `Manufacture: ${this.device.manufacturer}`,
                `Model: ${this.device.model}`,
                `Platform: ${this.device.platform}`,
                `OS version: ${this.device.version}`,
                `App version: ${await this.appVersion.getVersionNumber()}`
            ].join("\n");
            this.emailComposer.open({
                to: ["israelhikingmap@gmail.com"],
                subject: "Issue reported by " + this.userInfo.displayName,
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

    public isOnline(): boolean {
        return this.runningContextService.isOnline;
    }
}
