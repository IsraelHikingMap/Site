import { Injectable, NgZone } from "@angular/core";
import { Router } from "@angular/router";
import { MatDialog } from "@angular/material";
import { WebIntent, Intent } from "@ionic-native/web-intent/ngx";

import { RunningContextService } from "./running-context.service";
import { FileService } from "./file.service";
import { NonAngularObjectsFactory } from "./non-angular-objects.factory";
import { ToastService } from "./toast.service";
import { ResourcesService } from "./resources.service";
import { LoggingService } from "./logging.service";
import { RouteStrings } from "./hash.service";

declare var universalLinks: any;

interface Item {
    uri: string;
    path: string;
    base64: string;
    type: string;
}

@Injectable()
export class OpenWithService {
    constructor(private readonly resources: ResourcesService,
                private readonly runningContextService: RunningContextService,
                private readonly nonAngularObjectsFactory: NonAngularObjectsFactory,
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
                    let file = await this.fileService.getFileFromUrl(url);
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
                let clipData = (intent as any).clipItems as { uri: string }[];
                if (!data && !clipData) {
                    if (!intent.action.endsWith("MAIN")) {
                        this.loggingService.warning("[OpenWith] Could not extract data from intent: " + JSON.stringify(intent));
                    }
                    return;
                }
                if (clipData && Array.isArray(clipData) && clipData.length > 0) {
                    data = clipData[0].uri;
                }
                if (data.startsWith("http") || data.startsWith("geo")) {
                    this.handleExternalUrl(data);
                } else {
                    this.loggingService.info("[OpenWith] Opening an intent with data: " + data);
                    let file = await this.fileService.getFileFromUrl(data);
                    this.loggingService.info("[OpenWith] Translated the data to a file: " + file.name);
                    this.fileService.addRoutesFromFile(file);
                }
            } catch (ex) {
                this.loggingService.error(ex.message);
                this.toastService.error(this.resources.unableToLoadFromFile);
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

    private async handleFile(data: string, item: Item) {
        let stringValue = atob(data);
        let blob = this.nonAngularObjectsFactory.b64ToBlob(data, item.type) as any;
        if (!item.type || item.type === "application/octet-stream") {
            blob.name = this.getFormatStringValue(stringValue);
        } else if (item.path) {
            blob.name = item.path.split("/").slice(-1)[0];
        } else {
            if (item.type.indexOf("kml") !== -1) {
                blob.name = "file.kml";
            } else if (item.type.indexOf("kmz") !== -1) {
                blob.name = "file.kmz";
            } else if (item.type.indexOf("gpx") !== -1) {
                blob.name = "file.gpx";
            } else if (item.type.indexOf("twl") !== -1) {
                blob.name = "file.twl";
            } else if (item.type.indexOf("jpg") !== -1 || item.type.indexOf("jpeg") !== -1) {
                blob.name = "file.jpg";
            } else {
                blob.name = this.getFormatStringValue(stringValue);
            }
        }
        if (!blob.name) {
            this.loggingService.warning("[OpenWith] Unable to find file format, defaulting to twl?");
            blob.name = "file.twl";
        }
        try {
            this.loggingService.info("[OpenWith] Opening a file: " + blob.name + ", " + item.path + ", " + item.type);
            // Do not use "new File(...)" as it breaks the functionality.
            await this.fileService.addRoutesFromFile(blob);
        } catch (ex) {
            this.loggingService.error("Unable to open file from link: " + ex.toString());
            this.toastService.error(this.resources.unableToLoadFromFile);
        }
    }

    private getFormatStringValue(stringValue: string): string {
        if (stringValue.startsWith("PK")) {
            return "file.kmz";
        } else if (stringValue.toLowerCase().indexOf("<gpx") !== -1) {
            return "file.gpx";
        } else if (stringValue.toLowerCase().indexOf("<kml") !== -1) {
            return "file.kml";
        }
        return "";
    }
}
