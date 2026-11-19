
import { Component, inject, input, OnInit, signal } from "@angular/core";
import { CdkCopyToClipboard } from "@angular/cdk/clipboard";
import { MatTooltip } from "@angular/material/tooltip";
import { DatePipe, NgClass } from "@angular/common";
import { DistancePipe } from "../pipes/distance.pipe";
import { MatButton } from "@angular/material/button";
import { Router } from "@angular/router";
import { Share } from "@capacitor/share";
import type { Immutable } from "immer";

import { AnalyticsDirective } from "../directives/analytics.directive";
import { DeviceProviderLogoComponent } from "./device-provider-logo.component";
import { ShareUrlsService } from "../services/share-urls.service";
import { ResourcesService } from "../services/resources.service";
import { RunningContextService } from "../services/running-context.service";
import { ToastService } from "../services/toast.service";
import { RouteStrings } from "../services/hash.service";
import { DeviceProvidersService } from "../services/device-providers/device-providers.service";
import type { DeviceProviderId, ShareUrl } from "../models/";

@Component({
    selector: "share-item",
    templateUrl: "./share-item.component.html",
    imports: [DatePipe, DistancePipe, MatTooltip, MatButton, CdkCopyToClipboard, AnalyticsDirective, NgClass, DeviceProviderLogoComponent]
})
export class ShareItemComponent implements OnInit {
    public readonly shareUrl = input<Immutable<ShareUrl>>();

    public readonly copiedToClipboard = signal(false);
    public readonly shareAddress = signal<string>(null);
    public readonly whatsappShareAddress = signal<string>(null);
    public readonly facebookShareAddress = signal<string>(null);

    public readonly resources = inject(ResourcesService);

    private readonly shareUrlsService = inject(ShareUrlsService);
    private readonly runningContextService = inject(RunningContextService);
    private readonly toastService = inject(ToastService);
    private readonly deviceProvidersService = inject(DeviceProvidersService);
    private readonly router = inject(Router);

    public readonly deviceProviders = this.deviceProvidersService.visibleProviders;

    public ngOnInit(): void {
        const links = this.shareUrlsService.getShareSocialLinks(this.shareUrl());
        this.shareAddress.set(links.app);
        this.whatsappShareAddress.set(links.whatsapp);
        this.facebookShareAddress.set(links.facebook);
    }

    public getImageFromShareId(width: number, height: number) {
        return this.shareUrlsService.getImageUrlFromShareId(this.shareUrl().id, width, height);
    }

    public getIconFromType() {
        return this.shareUrlsService.getIconFromType(this.shareUrl().type);
    }

    public isApp() {
        return this.runningContextService.isCapacitor;
    }

    public share() {
        Share.share({
            url: this.shareAddress()
        });
    }

    public async sendToDevice(id: DeviceProviderId) {
        if (!this.deviceProvidersService.isConnected(id)) {
            this.toastService.confirm({
                type: "Custom",
                message: this.resources.connectServiceFirst,
                confirmAction: () => this.router.navigate([RouteStrings.ROUTE_SETTINGS]),
                customConfirmText: this.resources.settings,
                customDeclineText: this.resources.cancel
            });
            return;
        }
        const share = await this.shareUrlsService.getShareUrl(this.shareUrl().id);
        await this.deviceProvidersService.sendRoutes(id, share.dataContainer.routes);
    }
}
