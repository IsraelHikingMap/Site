import { Component, inject, OnInit, ViewEncapsulation } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Dir } from "@angular/cdk/bidi";
import { MatFormField, MatLabel } from "@angular/material/form-field";
import { MatInput } from "@angular/material/input";
import { MatButton, MatAnchor } from "@angular/material/button";
import { CdkScrollable } from "@angular/cdk/scrolling";
import { NgFor, NgClass, NgIf, AsyncPipe, DatePipe } from "@angular/common";
import { MatProgressSpinner } from "@angular/material/progress-spinner";
import { MatTooltip } from "@angular/material/tooltip";
import { MatMenu, MatMenuItem, MatMenuTrigger } from "@angular/material/menu";
import { CdkCopyToClipboard } from "@angular/cdk/clipboard";
import { MatDialog, MatDialogTitle, MatDialogClose, MatDialogContent, MatDialogActions } from "@angular/material/dialog";
import { FormControl, FormsModule, ReactiveFormsModule } from "@angular/forms";
import { Angulartics2OnModule } from "angulartics2";
import { InfiniteScrollDirective } from "ngx-infinite-scroll";
import { SocialSharing } from "@awesome-cordova-plugins/social-sharing/ngx";
import { take, orderBy } from "lodash-es";
import { Observable } from "rxjs";
import { Store } from "@ngxs/store";
import type { Immutable } from "immer";

import { ShareDialogComponent } from "./share-dialog.component";
import { ResourcesService } from "../../services/resources.service";
import { ToastService } from "../../services/toast.service";
import { ShareUrlsService } from "../../services/share-urls.service";
import { DataContainerService } from "../../services/data-container.service";
import { RunningContextService } from "../../services/running-context.service";
import { SelectedRouteService } from "../../services/selected-route.service";
import type { ApplicationState, ShareUrl } from "../../models/models";

@Component({
    selector: "shares-dialog",
    templateUrl: "shares-dialog.component.html",
    styleUrls: ["shares-dialog.component.scss"],
    encapsulation: ViewEncapsulation.None,
    imports: [InfiniteScrollDirective, Dir, MatDialogTitle, MatFormField, MatLabel, MatInput, FormsModule, ReactiveFormsModule, MatButton, MatDialogClose, CdkScrollable, MatDialogContent, Angulartics2OnModule, NgFor, NgClass, NgIf, MatProgressSpinner, MatDialogActions, MatTooltip, MatMenu, MatMenuItem, MatAnchor, CdkCopyToClipboard, MatMenuTrigger, AsyncPipe, DatePipe]
})
export class SharesDialogComponent implements OnInit {

    public filteredShareUrls: Immutable<ShareUrl[]>;
    public shareUrlInEditMode: ShareUrl = null;
    public selectedShareUrlId: string = null;
    public loadingShareUrls: boolean = false;
    public searchTerm = new FormControl<string>("");
    public shownShareUrl$: Observable<Immutable<ShareUrl>>;

    private sessionSearchTerm = "";
    private page: number = 1;

    public readonly resources = inject(ResourcesService);


    private readonly dialog = inject(MatDialog);
    private readonly toastService = inject(ToastService);
    private readonly shareUrlsService = inject(ShareUrlsService);
    private readonly dataContainerService = inject(DataContainerService);
    private readonly socialSharing = inject(SocialSharing);
    private readonly runningContextService = inject(RunningContextService);
    private readonly selectedRouteService = inject(SelectedRouteService);
    private readonly store = inject(Store);

    constructor() {
        this.searchTerm.valueChanges.pipe(takeUntilDestroyed()).subscribe((searchTerm: string) => {
            this.updateFilteredLists(searchTerm);
        });
        this.searchTerm.setValue(this.sessionSearchTerm);
        this.store.select((state: ApplicationState) => state.shareUrlsState.shareUrls).pipe(takeUntilDestroyed()).subscribe(() => {
            if (!this.loadingShareUrls) {
                this.updateFilteredLists(this.searchTerm.value);
            }
        });
        this.shownShareUrl$ = this.store.select((state: ApplicationState) => state.inMemoryState.shareUrl).pipe(takeUntilDestroyed());
    }

    public async ngOnInit() {
        this.loadingShareUrls = true;
        this.shareUrlsService.syncShareUrls();
        this.loadingShareUrls = false;
        this.updateFilteredLists(this.searchTerm.value);
    }

    public isApp(): boolean {
        return this.runningContextService.isCapacitor;
    }

    public share() {
        this.socialSharing.shareWithOptions({
            url: this.getShareSocialLinks().app
        });
    }

    public createShare() {
        this.dialog.open(ShareDialogComponent);
    }

    private updateFilteredLists(searchTerm: string) {
        searchTerm = searchTerm.trim();
        this.sessionSearchTerm = searchTerm;
        let shareUrls = this.store.selectSnapshot((s: ApplicationState) => s.shareUrlsState).shareUrls;
        shareUrls = orderBy(shareUrls.filter((s) => this.findInShareUrl(s, searchTerm)), ["lastModifiedDate"], ["desc"]);
        this.filteredShareUrls = take(shareUrls, this.page * 10);
    }

    private findInShareUrl(shareUrl: Immutable<ShareUrl>, searchTerm: string) {
        if (!searchTerm) {
            return true;
        }
        const lowerSearchTerm = searchTerm.toLowerCase();
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
        if (this.shareUrlInEditMode?.id === this.selectedShareUrlId) {
            this.shareUrlInEditMode = null;
        }
        const shareUrl = this.getSelectedShareUrl();
        const displayName = this.shareUrlsService.getShareUrlDisplayName(shareUrl);
        const message = `${this.resources.deletionOf} ${displayName}, ${this.resources.areYouSure}`;
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

    private getSelectedShareUrl(): Immutable<ShareUrl> {
        return this.store.selectSnapshot((s: ApplicationState) => s.shareUrlsState).shareUrls.find(s => s.id === this.selectedShareUrlId);
    }

    public isShareUrlInEditMode(shareUrlId: string) {
        return this.shareUrlInEditMode?.id === shareUrlId && this.filteredShareUrls.find(s => s.id === shareUrlId);
    }

    public async updateShareUrl() {
        await this.shareUrlsService.updateShareUrl(this.shareUrlInEditMode);
        this.shareUrlInEditMode = null;
        this.toastService.success(this.resources.dataUpdatedSuccessfully);
    }

    public async showShareUrl() {
        if (this.selectedRouteService.areRoutesEmpty()) {
            const share = await this.shareUrlsService.setShareUrlById(this.selectedShareUrlId);
            this.dataContainerService.setData(share.dataContainer, false);
            return;
        }
        this.toastService.confirm({
            message: this.resources.thisWillDeteleAllCurrentRoutesAreYouSure,
            confirmAction: async () => {
                const share = await this.shareUrlsService.setShareUrlById(this.selectedShareUrlId);
                this.dataContainerService.setData(share.dataContainer, false);
            },
            type: "YesNo"
        });
    }

    public async addShareUrlToRoutes() {
        const share = await this.shareUrlsService.getShareUrl(this.selectedShareUrlId);
        share.dataContainer.overlays = [];
        share.dataContainer.baseLayer = null;
        this.dataContainerService.setData(share.dataContainer, true);
    }

    public setShareUrlInEditMode() {
        this.shareUrlInEditMode = structuredClone(this.getSelectedShareUrl()) as ShareUrl;
    }

    public toggleSelectedShareUrl(shareUrl: ShareUrl) {
        if (this.selectedShareUrlId == null) {
            this.selectedShareUrlId = shareUrl.id;
        } else if (this.selectedShareUrlId === shareUrl.id && this.shareUrlInEditMode?.id !== shareUrl.id) {
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

    public hasNoShares(): boolean {
        return !this.loadingShareUrls && this.filteredShareUrls.length === 0;
    }

    public trackById(_: number, shareUrl: ShareUrl) {
        return shareUrl.id;
    }
}
