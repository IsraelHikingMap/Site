import { Component, OnInit, OnDestroy, ViewEncapsulation } from "@angular/core";
import { FormControl } from "@angular/forms";
import { Router } from "@angular/router";
import { SharedStorage } from "ngx-store";
import * as _ from "lodash";

import * as Common from "../../common/IsraelHiking";
import { Subscription } from "rxjs";
import { OsmUserService } from "../../services/osm-user.service";
import { BaseMapComponent } from "../base-map.component";
import { ResourcesService } from "../../services/resources.service";
import { ToastService } from "../../services/toast.service";
import { RouteStrings } from "../../services/hash.service";

@Component({
    selector: "shares-dialog",
    templateUrl: "shares-dialog.component.html",
    styleUrls: ["shares-dialog.component.scss"],
    encapsulation: ViewEncapsulation.None
})
export class SharesDialogComponent extends BaseMapComponent implements OnInit, OnDestroy {

    public filteredShareUrls: Common.ShareUrl[];
    public shareUrlInEditMode: Common.ShareUrl;
    public loadingShareUrls: boolean;
    public searchTerm: FormControl;
    public selectedShareUrl: Common.ShareUrl;

    @SharedStorage()
    private sessionSearchTerm = "";

    private page: number;
    private shareUrlChangedSubscription: Subscription;

    constructor(resources: ResourcesService,
        private readonly router: Router,
        private readonly toastService: ToastService,
        public readonly userService: OsmUserService) {
        super(resources);
        this.loadingShareUrls = false;
        this.shareUrlInEditMode = null;
        this.selectedShareUrl = null;
        this.page = 1;
        this.searchTerm = new FormControl();
        this.searchTerm.valueChanges.subscribe((searchTerm: string) => {
            this.updateFilteredLists(searchTerm);
        });
        this.searchTerm.setValue(this.sessionSearchTerm);
        this.shareUrlChangedSubscription = this.userService.shareUrlsChanged.subscribe(() => {
            this.updateFilteredLists(this.searchTerm.value);
            this.loadingShareUrls = false;
        });
    }

    public ngOnInit() {
        this.loadingShareUrls = true;
        this.userService.refreshDetails();
    }

    public ngOnDestroy() {
        this.shareUrlChangedSubscription.unsubscribe();
    }

    private updateFilteredLists(searchTerm: string) {
        searchTerm = searchTerm.trim();
        this.sessionSearchTerm = searchTerm;
        let shares = this.userService.shareUrls.filter((s) => this.findInShareUrl(s, searchTerm));
        this.filteredShareUrls = _.take(shares, this.page * 10);
    }

    private findInShareUrl(shareUrl: Common.ShareUrl, searchTerm: string) {
        if (!searchTerm) {
            return true;
        }
        let lowerSearchTerm = searchTerm.toLowerCase();
        if ((shareUrl.description || "").toLowerCase().includes(lowerSearchTerm)) {
            return true;
        }
        if ((shareUrl.title || "").toLowerCase().includes(lowerSearchTerm)) {
            return true;
        }
        if ((shareUrl.id || "").toLowerCase().includes(lowerSearchTerm)) {
            return true;
        }
        return false;
    }

    public deleteShareUrl(shareUrl: Common.ShareUrl) {
        if (this.shareUrlInEditMode === shareUrl) {
            this.shareUrlInEditMode = null;
        }
        let message = `${this.resources.deletionOf} ${this.userService.getShareUrlDisplayName(shareUrl)}, ${this.resources.areYouSure}`;
        this.toastService.confirm({
            message: message,
            confirmAction: () => this.userService.deleteShareUrl(shareUrl),
            type: "YesNo"
        });
    }

    public isShareUrlInEditMode(shareUrl: Common.ShareUrl) {
        return this.shareUrlInEditMode === shareUrl && this.filteredShareUrls.indexOf(shareUrl) !== -1;
    }

    public async updateShareUrl(shareUrl: Common.ShareUrl) {
        this.shareUrlInEditMode = null;
        await this.userService.updateShareUrl(shareUrl);
        this.toastService.success(this.resources.dataUpdatedSuccessfully);
    }

    public async convertShareUrlToRoute(shareUrl: Common.ShareUrl) {
        this.router.navigate([RouteStrings.ROUTE_SHARE, shareUrl.id]);
    }

    public toggleSelectedShareUrl(shareUrl) {
        if (this.selectedShareUrl === shareUrl) {
            this.selectedShareUrl = null;
        } else {
            this.selectedShareUrl = shareUrl;
        }
    }

    public hasSelected() {
        return this.selectedShareUrl != null && this.filteredShareUrls.indexOf(this.selectedShareUrl) !== -1;
    }

    public onScrollDown() {
        this.page++;
        this.updateFilteredLists(this.searchTerm.value);
    }
}