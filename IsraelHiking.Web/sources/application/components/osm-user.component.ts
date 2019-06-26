import { Component } from "@angular/core";
import { MatDialog, MatDialogConfig } from "@angular/material";
import { select } from "@angular-redux/store";
import { LocalStorage } from "ngx-store";
import { Observable } from "rxjs";
import { NgRedux } from "@angular-redux/store";

import { ResourcesService } from "../services/resources.service";
import { AuthorizationService } from "../services/authorization.service";
import { ToastService } from "../services/toast.service";
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
export class OsmUserComponent extends BaseMapComponent {

    private ranks: IRank[];

    @select((state: ApplicationState) => state.userState.userInfo)
    public userInfo: Observable<UserInfo>;

    @select((state: ApplicationState) => state.configuration.isAdvanced)
    public isAdvanced: Observable<boolean>;

    @LocalStorage()
    public agreedToTheTermsOfService = false;

    constructor(resources: ResourcesService,
                private readonly authorizationService: AuthorizationService,
                private readonly dialog: MatDialog,
                private readonly toastService: ToastService,
                private readonly ngRedux: NgRedux<ApplicationState>) {
        super(resources);
        this.initializeRanks();
        resources.languageChanged.subscribe(() => this.initializeRanks());
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

    public toggleIsAdvanced() {
        this.ngRedux.dispatch(ConfigurationActions.toggleIsAdvanceAction);
    }
}
