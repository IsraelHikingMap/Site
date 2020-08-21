import { Component, OnInit, ViewEncapsulation, OnDestroy } from "@angular/core";
import { FormControl } from "@angular/forms";
import { Router } from "@angular/router";
import { select, NgRedux } from "@angular-redux/store";
import { SharedStorage } from "ngx-store";
import { take } from "lodash";
import { Observable, Subscription } from "rxjs";

import { BaseMapComponent } from "../base-map.component";
import { ResourcesService } from "../../services/resources.service";
import { ToastService } from "../../services/toast.service";
import { RouteStrings } from "../../services/hash.service";
import { ShareUrl } from "../../models/share-url";
import { ShareUrlsService } from "../../services/share-urls.service";
import { DataContainerService } from "../../services/data-container.service";
import { ApplicationState } from "../../models/models";

@Component({
    selector: "shares-dialog",
    templateUrl: "shares-dialog.component.html",
    styleUrls: ["shares-dialog.component.scss"],
    encapsulation: ViewEncapsulation.None
})
export class SharesDialogComponent extends BaseMapComponent implements OnInit, OnDestroy {

    public filteredShareUrls: ShareUrl[];
    public shareUrlInEditMode: ShareUrl;
    public loadingShareUrls: boolean;
    public searchTerm: FormControl;
    public selectedShareUrl: ShareUrl;

    @select((state: ApplicationState) => state.shareUrlsState.shareUrls)
    public shareUrls$: Observable<ShareUrl[]>;

    @SharedStorage()
    private sessionSearchTerm = "";

    private page: number;
    private subscriptions: Subscription[];

    constructor(resources: ResourcesService,
                private readonly router: Router,
                private readonly toastService: ToastService,
                private readonly shareUrlsService: ShareUrlsService,
                private readonly dataContainerService: DataContainerService,
                private readonly ngRedux: NgRedux<ApplicationState>
    ) {
        super(resources);
        this.loadingShareUrls = false;
        this.shareUrlInEditMode = null;
        this.selectedShareUrl = null;
        this.page = 1;
        this.subscriptions = [];
        this.searchTerm = new FormControl();
        this.subscriptions.push(this.searchTerm.valueChanges.subscribe((searchTerm: string) => {
            this.updateFilteredLists(searchTerm);
        }));
        this.searchTerm.setValue(this.sessionSearchTerm);
        this.subscriptions.push(this.shareUrls$.subscribe(() => {
            this.updateFilteredLists(this.searchTerm.value);
            this.loadingShareUrls = false;
        }));
    }

    public ngOnInit() {
        this.loadingShareUrls = true;
        this.shareUrlsService.syncShareUrls();
    }

    public ngOnDestroy() {
        for (let subscription of this.subscriptions) {
            subscription.unsubscribe();
        }
    }

    private updateFilteredLists(searchTerm: string) {
        searchTerm = searchTerm.trim();
        this.sessionSearchTerm = searchTerm;
        let shares = this.ngRedux.getState().shareUrlsState.shareUrls.filter((s) => this.findInShareUrl(s, searchTerm));
        this.filteredShareUrls = take(shares, this.page * 10);
    }

    private findInShareUrl(shareUrl: ShareUrl, searchTerm: string) {
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

    public deleteShareUrl(shareUrl: ShareUrl) {
        if (this.shareUrlInEditMode === shareUrl) {
            this.shareUrlInEditMode = null;
        }
        let displayName = this.shareUrlsService.getShareUrlDisplayName(shareUrl);
        let message = `${this.resources.deletionOf} ${displayName}, ${this.resources.areYouSure}`;
        this.toastService.confirm({
            message,
            confirmAction: async () => {
                try {
                    await this.shareUrlsService.deleteShareUrl(shareUrl);
                    this.updateFilteredLists(this.searchTerm.value);
                } catch (ex) {
                    this.toastService.error(this.resources.unableToDeleteShare);
                }

            },
            type: "YesNo"
        });
    }

    public isShareUrlInEditMode(shareUrl: ShareUrl) {
        return this.shareUrlInEditMode === shareUrl && this.filteredShareUrls.indexOf(shareUrl) !== -1;
    }

    public async updateShareUrl(shareUrl: ShareUrl) {
        this.shareUrlInEditMode = null;
        await this.shareUrlsService.updateShareUrl(shareUrl);
        this.toastService.success(this.resources.dataUpdatedSuccessfully);
    }

    public showShareUrl(shareUrl: ShareUrl) {
        this.router.navigate([RouteStrings.ROUTE_SHARE, shareUrl.id]);
    }

    public async addShareUrlToRoutes(shareUrl: ShareUrl) {
        let share = await this.shareUrlsService.getShareUrl(shareUrl.id);
        share.dataContainer.overlays = [];
        share.dataContainer.baseLayer = null;
        this.dataContainerService.setData(share.dataContainer, true);
    }

    public toggleSelectedShareUrl(shareUrl) {
        if (this.selectedShareUrl === shareUrl) {
            this.selectedShareUrl = null;
        } else {
            this.selectedShareUrl = shareUrl;
        }
    }

    public hasSelected() {
        return this.selectedShareUrl != null && this.filteredShareUrls.find(s => s.id === this.selectedShareUrl.id) != null;
    }

    public onScrollDown() {
        this.page++;
        this.updateFilteredLists(this.searchTerm.value);
    }

    public getImageFromShareId(shareUrl, width, height) {
        return this.shareUrlsService.getImageFromShareId(shareUrl, width, height);
    }

    public getShareSocialLinks(shareUrl) {
        return this.shareUrlsService.getShareSocialLinks(shareUrl);
    }
}
