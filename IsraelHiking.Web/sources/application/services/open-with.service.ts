import { Injectable, NgZone } from "@angular/core";
import { Router } from "@angular/router";
import { MatDialog } from "@angular/material";

import { RunningContextService } from "./running-context.service";
import { FileService } from "./file.service";
import { NonAngularObjectsFactory } from "./non-angular-objects.factory";
import { ToastService } from "./toast.service";
import { ResourcesService } from "./resources.service";
import { LoggingService } from "./logging.service";
import { RouteStrings } from "./hash.service";
import { Urls } from "../urls";

declare var cordova: any;

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
                private readonly ngZone: NgZone) { }

    public initialize() {
        if (!this.runningContextService.isCordova || !cordova.openwith || !cordova.openwith.init) {
            return;
        }
        cordova.openwith.init(() => { }, (error) => this.loggingService.error(`Open with init failed with error: ${error}`));
        cordova.openwith.addHandler((intent) => {
            if (intent.items.length <= 0) {
                return;
            }
            cordova.openwith.load(intent.items[0],
                (data: string, item: Item) => {
                    this.ngZone.run(async () => {
                        if (data.length === 0) {
                            this.handleExternalUrl(item);
                        } else {
                            this.handleFile(data, item);
                        }
                    });
                });
        });
    }

    private handleExternalUrl(item: Item) {
        this.loggingService.info("Opening a shared url: " + item.uri);
        if (item.uri.indexOf(RouteStrings.ROUTE_SHARE + "/") !== -1 ||
            item.uri.indexOf(RouteStrings.ROUTE_POI + "/") !== -1 ||
            item.uri.indexOf(RouteStrings.ROUTE_URL + "/") !== -1 ||
            item.uri.indexOf(RouteStrings.ROUTE_MAP + "/") !== -1 ||
            item.uri.replace(/\//g, "").endsWith("israelhiking.osm.org.il")) {
            if (this.matDialog.openDialogs.length > 0) {
                this.matDialog.closeAll();
            }
            let escapedString = Urls.baseAddress.toLocaleLowerCase().replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
            let regexpToUse = new RegExp(escapedString, "ig");
            this.router.navigateByUrl(item.uri.replace(regexpToUse, ""));
            return;
        }
        if (item.uri.indexOf("maps?q=") !== -1) {
            let coordsRegExp = /q=(\d+\.\d+),(\d+\.\d+)&z=/;
            let coords = coordsRegExp.exec(decodeURIComponent(item.uri));
            this.moveToCoordinates(coords);
            return;
        }
        if (item.uri.indexOf("maps/place") !== -1) {
            let coordsRegExp = /\@(\d+\.\d+),(\d+\.\d+),/;
            let coords = coordsRegExp.exec(item.uri);
            this.moveToCoordinates(coords);
            return;
        }
        if (item.uri.indexOf("geo:") !== -1) {
            let coordsRegExp = /:(\d+\.\d+),(\d+\.\d+)/;
            let coords = coordsRegExp.exec(item.uri);
            this.moveToCoordinates(coords);
            return;
        }
        this.router.navigate([RouteStrings.ROUTE_URL, item.uri]);
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
            this.loggingService.warning("Unable to find file format, defaulting to twl?");
            blob.name = "file.twl";
        }
        try {
            this.loggingService.info("Opening a shared file: " + blob.name + ", " + item.path + ", " + item.type);
            // Do not use "new File(...)" as it breaks the functionality.
            await this.fileService.addRoutesFromFile(blob);
        } catch (ex) {
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
