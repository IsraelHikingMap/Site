
import { Component, inject, input, OnInit, output } from "@angular/core";
import { CdkCopyToClipboard } from "@angular/cdk/clipboard";
import { MatTooltip } from "@angular/material/tooltip";
import { DatePipe, NgClass } from "@angular/common";
import { DistancePipe } from "../pipes/distance.pipe";
import { MatMenu, MatMenuItem, MatMenuTrigger } from "@angular/material/menu";
import { MatButton } from "@angular/material/button";
import { Share } from "@capacitor/share";
import type { Immutable } from "immer";

import { AnalyticsDirective } from "../directives/analytics.directive";
import { ShareUrlsService } from "../services/share-urls.service";
import { ResourcesService } from "../services/resources.service";
import { RunningContextService } from "../services/running-context.service";
import { DeviceServicesService } from "../services/device-providers/device-services.service";
import type { DeviceProvider } from "../services/device-providers/device-provider";
import type { DeviceServiceId, ShareUrl } from "../models/";

@Component({
    selector: "share-item",
    templateUrl: "./share-item.component.html",
    imports: [DatePipe, DistancePipe, MatTooltip, MatMenu, MatMenuItem, MatMenuTrigger, MatButton, CdkCopyToClipboard, AnalyticsDirective, NgClass]
})
export class ShareItemComponent implements OnInit {
    public shareUrl = input<Immutable<ShareUrl>>();
    public showMenu = input<boolean>(false);
    public delete = output<void>();
    public editProperties = output<void>();
    public open = output<void>();
    public addToRoutes = output<void>();
    public moveToRoute = output<void>();
    public sendToDevice = output<DeviceServiceId>();

    public copiedToClipboard = false;
    public shareAddress: string;
    public whatsappShareAddress: string;
    public facebookShareAddress: string;
    public deviceProviders: DeviceProvider[]

    public readonly resources = inject(ResourcesService);

    private readonly shareUrlsService = inject(ShareUrlsService);
    private readonly runningContextService = inject(RunningContextService);
    private readonly deviceServices = inject(DeviceServicesService);

    public ngOnInit(): void {
        const links = this.shareUrlsService.getShareSocialLinks(this.shareUrl());
        this.shareAddress = links.app;
        this.whatsappShareAddress = links.whatsapp;
        this.facebookShareAddress = links.facebook;
        this.deviceProviders = this.deviceServices.getProviders();
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
            url: this.shareAddress
        });
    }
}