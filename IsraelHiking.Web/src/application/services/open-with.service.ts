import { Injectable, NgZone } from "@angular/core";
import { Router } from "@angular/router";
import { MatDialog } from "@angular/material/dialog";
import { App } from "@capacitor/app";

import { RunningContextService } from "./running-context.service";
import { FileService } from "./file.service";
import { ToastService } from "./toast.service";
import { ResourcesService } from "./resources.service";
import { LoggingService } from "./logging.service";
import { getIdFromLatLng, RouteStrings } from "./hash.service";
import { SpatialService } from "./spatial.service";

@Injectable()
export class OpenWithService {
    constructor(private readonly resources: ResourcesService,
                private readonly runningContextService: RunningContextService,
                private readonly fileService: FileService,
                private readonly toastService: ToastService,
                private readonly matDialog: MatDialog,
                private readonly router: Router,
                private readonly loggingService: LoggingService,
                private readonly ngZone: NgZone) { }

    public initialize() {
        if (!this.runningContextService.isCapacitor) {
            return;
        }
        App.addListener("appUrlOpen", (data) => {
            if (!data || !data.url) {
                return;
            }
            if (data.url.startsWith("ihm://")) {
                // no need to do anything as this is part of the login flow
                return;
            }
            if (data.url.startsWith("geo")) {
                const coordsRegExp = /:(-?\d+\.\d+),(-?\d+\.\d+)/;
                const coords = coordsRegExp.exec(data.url);
                this.moveToCoordinates(coords);
                return;
            }
            if (data.url.startsWith("http")) {
                this.handleHttpUrl(data.url);
            } else {
                this.handleFileUrl(data.url);
            }
        });
    }

    private handleIHMUrl(url: URL) {
        this.logAndCloseDialogs(url);
        const pathname = url.pathname;
        if (pathname.startsWith("/share")) {
            const shareId = pathname.replace("/share/", "");
            this.ngZone.run(() => {
                this.router.navigate([RouteStrings.ROUTE_SHARE, shareId]);
            });
        } else if (pathname.startsWith("/poi")) {
            const sourceAndId = pathname.replace("/poi/", "");
            const source = sourceAndId.split("/")[0];
            const id = sourceAndId.split("/")[1];
            const language = new URLSearchParams(url.search).get("language");
            this.ngZone.run(() => {
                this.router.navigate([RouteStrings.ROUTE_POI, source, id],
                    { queryParams: { language } });
            });
        } else if (pathname.startsWith("/url")) {
            const urlData = pathname.replace("/url/", "");
            const baseLayer = new URLSearchParams(url.search).get("baselayer");
            this.ngZone.run(() => {
                this.router.navigate([RouteStrings.ROUTE_URL, urlData],
                    { queryParams: { baseLayer } });
            });
        } else if (pathname.startsWith("/map")) {
            const mapLocation = pathname.replace("/map/", "");
            const zoom = mapLocation.split("/")[0];
            const lat = mapLocation.split("/")[1];
            const lng = mapLocation.split("/")[2];
            this.ngZone.run(() => {
                this.router.navigate([RouteStrings.ROUTE_MAP, zoom, lat, lng]);
            });
        } else {
            this.ngZone.run(() => {
                this.router.navigate(["/"]);
            });
        }
    }

    private handleFileUrl(url: string) {
        this.loggingService.info("[OpenWith] Opening a file shared with the app " + url);
        setTimeout(async () => {
            try {
                const file = await this.fileService.getFileFromUrl(url);
                this.fileService.addRoutesFromFile(file);
            } catch (ex) {
                this.toastService.error(ex, this.resources.unableToLoadFromFile);
            }
        }, 0);
    }

    private handleHttpUrl(href: string) {
        const url = new URL(href);
        if (url.host.toLocaleLowerCase() === "israelhiking.osm.org.il") {
            this.handleIHMUrl(url);
            return;
        }
        this.loggingService.info("[OpenWith] Opening an external url: " + href);
        if (url.href.indexOf("maps?q=") !== -1) {
            const coordsRegExp = /q=(\d+\.\d+),(\d+\.\d+)&z=/;
            const coords = coordsRegExp.exec(decodeURIComponent(href));
            this.moveToCoordinates(coords);
            return;
        }
        if (url.href.indexOf("maps/place") !== -1) {
            const coordsRegExp = /@(\d+\.\d+),(\d+\.\d+),/;
            const coords = coordsRegExp.exec(href);
            this.moveToCoordinates(coords);
            return;
        }
        this.router.navigate([RouteStrings.ROUTE_URL, href]);
    }

    private logAndCloseDialogs(url: URL) {
        this.loggingService.info("[OpenWith] Opening: " + url.href);
        if (this.matDialog.openDialogs.length > 0) {
            this.matDialog.closeAll();
        }
    }

    private moveToCoordinates(coords: string[]) {
        const latLng = SpatialService.toLatLng([+coords[2], +coords[1]]);
        this.router.navigate([RouteStrings.ROUTE_POI, RouteStrings.COORDINATES, getIdFromLatLng(latLng)],
            { queryParams: { language: this.resources.getCurrentLanguageCodeSimplified() } });
    }
}
