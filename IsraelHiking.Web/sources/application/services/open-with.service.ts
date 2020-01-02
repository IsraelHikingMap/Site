import { Injectable, NgZone } from "@angular/core";
import { Router } from "@angular/router";

import { RunningContextService } from "./running-context.service";
import { FileService } from "./file.service";
import { NonAngularObjectsFactory } from "./non-angular-objects.factory";
import { ToastService } from "./toast.service";
import { ResourcesService } from "./resources.service";
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
    private static readonly SHARE = "/share/";
    private static readonly URL = "/url/";
    private static readonly POI = "/poi/";

    constructor(private readonly resources: ResourcesService,
                private readonly runningContextService: RunningContextService,
                private readonly nonAngularObjectsFactory: NonAngularObjectsFactory,
                private readonly fileService: FileService,
                private readonly toastService: ToastService,
                private readonly router: Router,
                private readonly ngZone: NgZone) { }

    public initialize() {
        if (!this.runningContextService.isCordova || !cordova.openwith || !cordova.openwith.init) {
            return;
        }
        cordova.openwith.init(() => { }, (error) => console.error(`init failed with error: ${error}`));
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
        if (item.uri.indexOf(OpenWithService.SHARE) !== -1 ||
            item.uri.indexOf(OpenWithService.POI) !== -1 ||
            item.uri.indexOf(OpenWithService.URL) !== -1) {
            let escapedString = Urls.baseAddress.toLocaleLowerCase().replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
            let regexpToUse = new RegExp(escapedString, "ig");
            this.router.navigateByUrl(item.uri.replace(regexpToUse, ""));
            return;
        }
        if (item.uri.indexOf("maps?q=") !== -1) {
            console.log("maps:" + decodeURIComponent(item.uri));
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
            blob.name = "file.twl";
            if (stringValue.startsWith("PK")) {
                blob.name = "file.kmz";
            } else if (stringValue.indexOf("<gpx") !== -1) {
                blob.name = "file.gpx";
            } else if (stringValue.indexOf("<kml") !== -1) {
                blob.name = "file.kml";
            }
        } else if (item.path) {
            blob.name = item.path.split("/").slice(-1)[0];
        } else {
            if (item.type.indexOf("kml") !== -1) {
                blob.name = "file.kml";
            } else if (item.type.indexOf("kmz") !== -1) {
                blob.name = "file.kml";
            } else if (item.type.indexOf("gpx") !== -1) {
                blob.name = "file.kml";
            } else if (item.type.indexOf("twl") !== -1) {
                blob.name = "file.kml";
            } else if (item.type.indexOf("jpg") !== -1 || item.type.indexOf("jpeg") !== -1) {
                blob.name = "file.kml";
            }
        }
        try {
            await this.fileService.addRoutesFromFile(blob);
        } catch (ex) {
            this.toastService.error(this.resources.unableToLoadFromFile);
        }
    }
}
