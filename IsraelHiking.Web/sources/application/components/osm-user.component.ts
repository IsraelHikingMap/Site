/// <reference types="cordova" />
/// <reference types="cordova-plugin-email-composer" />
import { Component, OnDestroy } from "@angular/core";
import { MatDialog, MatDialogConfig } from "@angular/material";
import { select } from "@angular-redux/store";
import { LocalStorage } from "ngx-store";
import { Observable, Subscription } from "rxjs";
import { NgRedux } from "@angular-redux/store";
import { Base64 } from "js-base64";

import { ResourcesService } from "../services/resources.service";
import { AuthorizationService } from "../services/authorization.service";
import { ToastService } from "../services/toast.service";
import { LoggingService } from "../services/logging.service";
import { RunningContextService } from "../services/running-context.service";
import { BaseMapComponent } from "./base-map.component";
import { TracesDialogComponent } from "./dialogs/traces-dialog.component";
import { SharesDialogComponent } from "./dialogs/shares-dialog.component";
import { TermsOfServiceDialogComponent } from "./dialogs/terms-of-service-dialog.component";
import { ConfigurationActions } from "../reducres/configuration.reducer";
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

    @select((state: ApplicationState) => state.configuration.isAdvanced)
    public isAdvanced: Observable<boolean>;

    @select((state: ApplicationState) => state.configuration.isBatteryOptimization)
    public isBatteryOptimization: Observable<boolean>;

    @LocalStorage()
    public agreedToTheTermsOfService = false;

    constructor(resources: ResourcesService,
                private readonly authorizationService: AuthorizationService,
                private readonly dialog: MatDialog,
                private readonly runningContextService: RunningContextService,
                private readonly toastService: ToastService,
                private readonly loggingService: LoggingService,
                private readonly ngRedux: NgRedux<ApplicationState>) {
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
            let logBase64 = Base64.encode(logs);
            cordova.plugins.email.open({
                to: ["israelhikingmap@gmail.com"],
                subject: "Issue reported by " + this.userInfo.displayName,
                body: this.resources.reportAnIssueInstructions,
                attachments: ["base64:log.txt//" + logBase64]
            });
        } catch (ex) {
            alert(`Ooopppss... Any chance you can take a screenshot and send it to israelhikingmap@gmail.com? \nSend issue failed: ${ex.toString()}`);
        }
        
    }

    public toggleIsAdvanced() {
        this.ngRedux.dispatch(ConfigurationActions.toggleIsAdvanceAction);
    }

    public toggleBatteryOprimization() {
        this.ngRedux.dispatch(ConfigurationActions.toggleIsBatteryOptimizationAction);
    }

    public isOnline(): boolean {
        return this.runningContextService.isOnline;
    }
}
