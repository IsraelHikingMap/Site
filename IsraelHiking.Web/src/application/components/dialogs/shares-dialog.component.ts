import { Component, OnInit, ViewEncapsulation, OnDestroy } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { FormControl } from "@angular/forms";
import { SocialSharing } from "@ionic-native/social-sharing/ngx";
import { take, orderBy } from "lodash-es";
import { Observable, Subscription } from "rxjs";
import { select, NgRedux } from "@angular-redux2/store";

import { BaseMapComponent } from "../base-map.component";
import { ShareDialogComponent } from "./share-dialog.component";
import { ResourcesService } from "../../services/resources.service";
import { ToastService } from "../../services/toast.service";
import { ShareUrlsService } from "../../services/share-urls.service";
import { DataContainerService } from "../../services/data-container.service";
import { RunningContextService } from "../../services/running-context.service";
import { RecordedRouteService } from "../../services/recorded-route.service";
import type { ApplicationState, ShareUrl } from "../../models/models";

@Component({
    selector: "shares-dialog",
    templateUrl: "shares-dialog.component.html",
    styleUrls: ["shares-dialog.component.scss"],
    encapsulation: ViewEncapsulation.None
})
export class SharesDialogComponent extends BaseMapComponent implements OnInit, OnDestroy {

    public filteredShareUrls: ShareUrl[];
    public shareUrlIdInEditMode: string;
    public selectedShareUrlId: string;
    public loadingShareUrls: boolean;
    public searchTerm: FormControl;

    @select((state: ApplicationState) => state.shareUrlsState.shareUrls)
    public shareUrls$: Observable<ShareUrl[]>;

    @select((state: ApplicationState) => state.inMemoryState.shareUrl)
    public shownShareUrl$: Observable<ShareUrl>;

    private sessionSearchTerm = "";
    private page: number;
    private subscriptions: Subscription[];

    constructor(resources: ResourcesService,
                private readonly dialog: MatDialog,
                private readonly toastService: ToastService,
                private readonly shareUrlsService: ShareUrlsService,
                private readonly dataContainerService: DataContainerService,
                private readonly socialSharing: SocialSharing,
                private readonly runningContextService: RunningContextService,
                private readonly recordedRouteService: RecordedRouteService,
                private readonly ngRedux: NgRedux<ApplicationState>
    ) {
        super(resources);
        this.loadingShareUrls = false;
        this.shareUrlIdInEditMode = null;
        this.selectedShareUrlId = null;
        this.page = 1;
        this.subscriptions = [];
        this.searchTerm = new FormControl();
        this.subscriptions.push(this.searchTerm.valueChanges.subscribe((searchTerm: string) => {
            this.updateFilteredLists(searchTerm);
        }));
        this.searchTerm.setValue(this.sessionSearchTerm);
        this.subscriptions.push(this.shareUrls$.subscribe(() => {
            this.updateFilteredLists(this.searchTerm.value);
        }));
    }

    public async ngOnInit() {
        this.loadingShareUrls = this.ngRedux.getState().shareUrlsState.shareUrls.length === 0;
        this.shareUrlsService.syncShareUrls();
        this.loadingShareUrls = false;
    }

    public ngOnDestroy() {
        for (let subscription of this.subscriptions) {
            subscription.unsubscribe();
        }
    }

    public isApp(): boolean {
        return this.runningContextService.isCordova;
    }

    public share() {
        this.socialSharing.shareWithOptions({
            url: this.getShareSocialLinks().ihm
        });
    }

    public createShare() {
        this.dialog.open(ShareDialogComponent);
    }

    private updateFilteredLists(searchTerm: string) {
        searchTerm = searchTerm.trim();
        this.sessionSearchTerm = searchTerm;
        let shareUrls = this.ngRedux.getState().shareUrlsState.shareUrls;
        shareUrls = orderBy(shareUrls.filter((s) => this.findInShareUrl(s, searchTerm)), ["lastModifiedDate"], ["desc"]);
        this.filteredShareUrls = take(shareUrls, this.page * 10);
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

    public deleteShareUrl() {
        if (this.shareUrlIdInEditMode === this.selectedShareUrlId) {
            this.shareUrlIdInEditMode = null;
        }
        let shareUrl = this.getSelectedShareUrl();
        let displayName = this.shareUrlsService.getShareUrlDisplayName(shareUrl);
        let message = `${this.resources.deletionOf} ${displayName}, ${this.resources.areYouSure}`;
        this.toastService.confirm({
            message,
            confirmAction: async () => {
                try {
                    await this.shareUrlsService.deleteShareUrl(shareUrl);
                    this.updateFilteredLists(this.searchTerm.value);
                } catch (ex) {
                    this.toastService.error(ex, this.resources.unableToDeleteShare);
                }

            },
            type: "YesNo"
        });
    }

    private getSelectedShareUrl(): ShareUrl {
        return this.ngRedux.getState().shareUrlsState.shareUrls.find(s => s.id === this.selectedShareUrlId);
    }

    public isShareUrlInEditMode(shareUrlId: string) {
        return this.shareUrlIdInEditMode === shareUrlId && this.filteredShareUrls.find(s => s.id === shareUrlId);
    }

    public async updateShareUrl() {
        let shareUrl = this.filteredShareUrls.find(s => s.id === this.shareUrlIdInEditMode);
        this.shareUrlIdInEditMode = null;
        await this.shareUrlsService.updateShareUrl(shareUrl);
        this.toastService.success(this.resources.dataUpdatedSuccessfully);
    }

    public async showShareUrl() {
        if (!this.recordedRouteService.isRecording()) {
            this.showDeleteAllRoutesConfirmation();
            return;
        }
        this.toastService.confirm({
            message: this.resources.areYouSureYouWantToStopRecording,
            confirmAction: () => {
                this.recordedRouteService.stopRecording();
                this.showDeleteAllRoutesConfirmation();
            },
            type: "YesNo"
        });
    }

    private showDeleteAllRoutesConfirmation() {
        this.toastService.confirm({
            message: this.resources.thisWillDeteleAllCurrentRoutesAreYouSure,
            confirmAction: async () => {
                let share = await this.shareUrlsService.setShareUrlById(this.selectedShareUrlId);
                this.dataContainerService.setData(share.dataContainer, false);
            },
            type: "YesNo"
        });
    }

    public async addShareUrlToRoutes() {
        let share = await this.shareUrlsService.getShareUrl(this.selectedShareUrlId);
        share.dataContainer.overlays = [];
        share.dataContainer.baseLayer = null;
        this.dataContainerService.setData(share.dataContainer, true);
    }

    public toggleSelectedShareUrl(shareUrl: ShareUrl) {
        if (this.selectedShareUrlId == null) {
            this.selectedShareUrlId = shareUrl.id;
        } else if (this.selectedShareUrlId === shareUrl.id && this.shareUrlIdInEditMode !== shareUrl.id) {
            this.selectedShareUrlId = null;
        } else {
            this.selectedShareUrlId = shareUrl.id;
        }
    }

    public hasSelected() {
        return this.selectedShareUrlId != null && this.filteredShareUrls.find(s => s.id === this.selectedShareUrlId);
    }

    public onScrollDown() {
        this.page++;
        this.updateFilteredLists(this.searchTerm.value);
    }

    public getImageFromShareId(shareUrl: ShareUrl, width: number, height: number) {
        return this.shareUrlsService.getImageFromShareId(shareUrl, width, height);
    }

    public getShareSocialLinks() {
        return this.shareUrlsService.getShareSocialLinks(this.getSelectedShareUrl());
    }
}
