import { Injectable, NgZone } from "@angular/core";
import { Router } from "@angular/router";
import { MatDialog } from "@angular/material/dialog";
import { WebIntent, Intent } from "@ionic-native/web-intent/ngx";

import { RunningContextService } from "./running-context.service";
import { FileService } from "./file.service";
import { ToastService } from "./toast.service";
import { ResourcesService } from "./resources.service";
import { LoggingService } from "./logging.service";
import { ImageResizeService } from "./image-resize.service";
import { RouteStrings } from "./hash.service";

declare let universalLinks: any;

interface UniversalLinkEvent {
    path: string;
    params: any;
}

@Injectable()
export class OpenWithService {
    constructor(private readonly resources: ResourcesService,
                private readonly runningContextService: RunningContextService,
                private readonly fileService: FileService,
                private readonly toastService: ToastService,
                private readonly matDialog: MatDialog,
                private readonly router: Router,
                private readonly loggingService: LoggingService,
                private readonly webIntent: WebIntent,
                private readonly ngZone: NgZone) { }

    public initialize() {
        if (!this.runningContextService.isCordova) {
            return;
        }
        this.loggingService.info("[OpenWith] subscribing to universal link events");
        universalLinks.subscribe("share", (event: UniversalLinkEvent) => {
            this.loggingService.info("[OpenWith] Opening a share: " + event.path);
            if (this.matDialog.openDialogs.length > 0) {
                this.matDialog.closeAll();
            }
            let shareId = event.path.replace("/share/", "");
            this.ngZone.run(() => {
                this.router.navigate([RouteStrings.ROUTE_SHARE, shareId]);
            });
        });
        universalLinks.subscribe("poi", (event: UniversalLinkEvent) => {
            this.logAndCloseDialogs(event);
            let sourceAndId = event.path.replace("/poi/", "");
            let source = sourceAndId.split("/")[0];
            let id = sourceAndId.split("/")[1];
            let language = event.params.language;
            this.ngZone.run(() => {
                this.router.navigate([RouteStrings.ROUTE_POI, source, id],
                    { queryParams: { language } });
            });
        });
        universalLinks.subscribe("url", (event: UniversalLinkEvent) => {
            this.logAndCloseDialogs(event);
            let url = event.path.replace("/url/", "");
            let baseLayer = event.params.baselayer;
            this.ngZone.run(() => {
                this.router.navigate([RouteStrings.ROUTE_URL, url],
                    { queryParams: { baseLayer } });
            });
        });
        universalLinks.subscribe("map", (event: UniversalLinkEvent) => {
            this.logAndCloseDialogs(event);
            let mapLocation = event.path.replace("/map/", "");
            let zoom = mapLocation.split("/")[0];
            let lat = mapLocation.split("/")[1];
            let lng = mapLocation.split("/")[2];
            this.ngZone.run(() => {
                this.router.navigate([RouteStrings.ROUTE_MAP, zoom, lat, lng]);
            });
        });
        universalLinks.subscribe(null, (event: UniversalLinkEvent) => {
            this.logAndCloseDialogs(event);
            this.ngZone.run(() => {
                this.router.navigate(["/"]);
            });
        });

        if ((window as any).externalUrl) {
            this.handleUrl((window as any).externalUrl);
            delete (window as any).externalUrl;
        }
        (window as any).handleExternalUrl = (url: string) => this.handleUrl(url);

        this.webIntent.getIntent().then(intent => this.handleIntent(intent));

        this.webIntent.onIntent().subscribe((intent) => {
            this.handleIntent(intent);
        });
    }

    private logAndCloseDialogs(event: UniversalLinkEvent) {
        this.loggingService.info("[OpenWith] Opening: " + event.path);
        if (this.matDialog.openDialogs.length > 0) {
            this.matDialog.closeAll();
        }
    }

    private handleUrl(url: string) {
        if (url.startsWith("ihm://")) {
            // no need to do anything as this is part of the login flow
            return;
        }
        this.loggingService.info("[OpenWith] Opening a file shared with the app " + url);
        setTimeout(async () => {
                try {
                    let file = await this.fileService.getFileFromUrl(url);
                    this.fileService.addRoutesFromFile(file);
                } catch (ex) {
                    this.toastService.error(ex, this.resources.unableToLoadFromFile);
                }
            }, 0);
    }

    private handleIntent(intent: Intent) {
        this.ngZone.run(async () => {
            try {
                let data = (intent as any).data as string;
                if (!data && !intent.clipItems) {
                    if (!intent.action.endsWith("MAIN")) {
                        this.loggingService.warning("[OpenWith] Could not extract data from intent: " + JSON.stringify(intent));
                    }
                    return;
                }
                if (intent.clipItems && intent.clipItems.length > 0) {
                    data = intent.clipItems[0].uri;
                }
                if (data.startsWith("ihm://")) {
                    // no need to do anything as this is part of the login flow
                    return;
                }
                if (data.startsWith("http") || data.startsWith("geo")) {
                    this.handleExternalUrl(data);
                } else {
                    this.loggingService.info("[OpenWith] Opening an intent with data: " + data + " type: " + intent.type);
                    if (intent.type && intent.type.startsWith("image/")) {
                        // this is hacking, but there's no good way to get the real file name when an image is shared...
                        intent.type = ImageResizeService.JPEG;
                    }
                    let file = await this.fileService.getFileFromUrl(data, intent.type);
                    this.loggingService.info("[OpenWith] Translated the data to a file: " + file.name + " " + file.type);
                    await this.fileService.addRoutesFromFile(file);
                }
            } catch (ex) {
                this.toastService.error(ex, this.resources.unableToLoadFromFile);
            }
        });
    }

    private handleExternalUrl(uri: string) {
        if (uri.toLocaleLowerCase().indexOf("israelhiking.osm.org.il") !== -1) {
            // handled by deep links plugin
            return;
        }
        this.loggingService.info("[OpenWith] Opening a url: " + uri);
        if (uri.indexOf("maps?q=") !== -1) {
            let coordsRegExp = /q=(\d+\.\d+),(\d+\.\d+)&z=/;
            let coords = coordsRegExp.exec(decodeURIComponent(uri));
            this.moveToCoordinates(coords);
            return;
        }
        if (uri.indexOf("maps/place") !== -1) {
            let coordsRegExp = /\@(\d+\.\d+),(\d+\.\d+),/;
            let coords = coordsRegExp.exec(uri);
            this.moveToCoordinates(coords);
            return;
        }
        if (uri.indexOf("geo:") !== -1) {
            let coordsRegExp = /:(-?\d+\.\d+),(-?\d+\.\d+)/;
            let coords = coordsRegExp.exec(uri);
            this.moveToCoordinates(coords);
            return;
        }
        this.router.navigate([RouteStrings.ROUTE_URL, uri]);
    }

    private moveToCoordinates(coords: string[]) {
        this.router.navigate([RouteStrings.ROUTE_POI, "Coordinates", `${(+coords[1]).toFixed(4)}_${(+coords[2]).toFixed(4)}`],
            { queryParams: { language: this.resources.getCurrentLanguageCodeSimplified() } });
    }
}
