import { Component } from "@angular/core";
import { MatDialog, MatDialogConfig } from "@angular/material";
import { LocalStorage } from "ngx-store";

import { ResourcesService } from "../services/resources.service";
import { OsmUserService } from "../services/osm-user.service";
import { ToastService } from "../services/toast.service";
import { BaseMapComponent } from "./base-map.component";
import { TracesDialogComponent } from "./dialogs/traces-dialog.component";
import { SharesDialogComponent } from "./dialogs/shares-dialog.component";
import { TermsOfServiceDialogComponent } from "./dialogs/terms-of-service-dialog.component";

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

    @LocalStorage()
    public agreedToTheTermsOfService = false;

    constructor(resources: ResourcesService,
        public readonly userService: OsmUserService,
        private readonly dialog: MatDialog,
        private readonly toastService: ToastService) {
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

    public login(e: Event) {
        this.suppressEvents(e);
        if (!this.agreedToTheTermsOfService) {
            let component = this.dialog.open(TermsOfServiceDialogComponent);
            component.afterClosed().subscribe((results: string) => {
                if (results === "true") {
                    this.agreedToTheTermsOfService = true;
                }
            });
        } else {
            this.userService.login().then(() => { }, () => {
                this.toastService.warning(this.resources.unableToLogin);
            });
        }
    }

    public openTraces() {
        this.dialog.open(TracesDialogComponent, { width: "480px" } as MatDialogConfig);
    }

    public openShares() {
        this.dialog.open(SharesDialogComponent, { width: "480px" } as MatDialogConfig);
    }

    public getRank() {
        let rankIndex = 0;
        while (this.userService.changeSets > this.ranks[rankIndex].points) {
            rankIndex++;
        }
        return this.ranks[rankIndex];
    }

    public getRankPercentage() {
        let rank = this.getRank();
        if (rank === this.ranks[this.ranks.length - 1]) {
            return 100;
        }
        return ((this.userService.changeSets / rank.points) * 100);
    }

    public getProgressbarType() {
        if (this.getRankPercentage() < 5) {
            return "Warn";
        }
        if (this.getRankPercentage() < 30) {
            return "Accent";
        }
        return "Primary";
    }
}