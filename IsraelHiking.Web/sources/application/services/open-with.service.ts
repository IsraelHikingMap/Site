import { Injectable, NgZone } from "@angular/core";
import { Router } from "@angular/router";
import { MatDialog } from "@angular/material";
import { WebIntent, Intent } from "@ionic-native/web-intent/ngx";

import { RunningContextService } from "./running-context.service";
import { FileService } from "./file.service";
import { ToastService } from "./toast.service";
import { ResourcesService } from "./resources.service";
import { LoggingService } from "./logging.service";
import { ImageResizeService } from "./image-resize.service";
import { RouteStrings } from "./hash.service";

declare var universalLinks: any;

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
        universalLinks.subscribe("share", (event) => {
            this.loggingService.info("[OpenWith] Opening a share: " + event.path);
            if (this.matDialog.openDialogs.length > 0) {
                this.matDialog.closeAll();
            }
            let shareId = event.path.replace("/share/", "");
            this.ngZone.run(() => {
                this.router.navigate([RouteStrings.ROUTE_SHARE, shareId]);
            });
        });
        universalLinks.subscribe("poi", (event) => {
            this.loggingService.info("[OpenWith] Opening a poi: " + event.path);
            if (this.matDialog.openDialogs.length > 0) {
                this.matDialog.closeAll();
            }
            let sourceAndId = event.path.replace("/poi/", "");
            let source = sourceAndId.split("/")[0];
            let id = sourceAndId.split("/")[1];
            let language = event.params.language;
            this.ngZone.run(() => {
                this.router.navigate([RouteStrings.ROUTE_POI, source, id],
                    { queryParams: { language } });
            });
        });
        universalLinks.subscribe("url", (event) => {
            this.loggingService.info("[OpenWith] Opening a file url: " + event.path);
            if (this.matDialog.openDialogs.length > 0) {
                this.matDialog.closeAll();
            }
            let url = event.path.replace("/url/", "");
            let baseLayer = event.params.baselayer;
            this.ngZone.run(() => {
                this.router.navigate([RouteStrings.ROUTE_URL, url],
                    { queryParams: { baseLayer } });
            });
        });
        universalLinks.subscribe(null, (event) => {
            this.loggingService.info("[OpenWith] Opening the null: " + event.path);
            if (this.matDialog.openDialogs.length > 0) {
                this.matDialog.closeAll();
            }
            this.ngZone.run(() => {
                this.router.navigate(["/"]);
            });
        });
        (window as any).handleOpenURL = (url: string) => {
            this.loggingService.info("[OpenWith] Opening a file shared with the app " + url);
            setTimeout(async () => {
                try {
                    let file = await this.fileService.getFileFromUrl(url, this.getTypeFromUrl(url));
                    this.fileService.addRoutesFromFile(file);
                } catch (ex) {
                    this.loggingService.error(ex.message);
                    this.toastService.error(this.resources.unableToLoadFromFile);
                }
            }, 0);
        };
        this.webIntent.getIntent().then(intent => this.handleIntent(intent));

        this.webIntent.onIntent().subscribe((intent) => {
            this.handleIntent(intent);
        });
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
                if (data.startsWith("http") || data.startsWith("geo")) {
                    this.handleExternalUrl(data);
                } else {
                    this.loggingService.info("[OpenWith] Opening an intent with data: " + data + " type: " + intent.type);
                    if (intent.type && intent.type.startsWith("image/")) {
                        // this is hacking, but there's no good way to get the real file name when an image is shared...
                        intent.type = ImageResizeService.JPEG;
                    }
                    let file = await this.fileService.getFileFromUrl(data, intent.type || this.getTypeFromUrl(data));
                    this.loggingService.info("[OpenWith] Translated the data to a file: " + file.name + " " + file.type);
                    await this.fileService.addRoutesFromFile(file);
                }
            } catch (ex) {
                this.loggingService.error(ex.message);
                this.toastService.error(this.resources.unableToLoadFromFile);
            }
        });
    }

    private getTypeFromUrl(url: string) {
        let fileExtension = url.split("/").pop().split(".").pop().toLocaleLowerCase();
        if (fileExtension === "gpx") {
            return "application/gpx+xml";
        }
        if (fileExtension === "kml") {
            return "application/kml+xml";
        }
        if (fileExtension === "jpg" || fileExtension === "jpeg") {
            return ImageResizeService.JPEG;
        }
        return "appliction/" + fileExtension;
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
