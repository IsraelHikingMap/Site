import { Injectable } from "@angular/core";

import { RunningContextService } from "./running-context.service";
import { FileService } from "./file.service";
import { NonAngularObjectsFactory } from "./non-angular-objects.factory";
import { ToastService } from "./toast.service";
import { ResourcesService } from "./resources.service";

declare var cordova: any;

@Injectable()
export class AssociatedFilesService {
    constructor(private readonly resources: ResourcesService,
        private readonly runningContextService: RunningContextService,
        private readonly nonAngularObjectsFactory: NonAngularObjectsFactory,
        private readonly fileService: FileService,
        private readonly toastService: ToastService) { }

    public initialize() {
        if (!this.runningContextService.isCordova) {
            return;
        }
        cordova.openwith.init(() => {}, (error) => console.log(`init failed with error: ${error}`));
        cordova.openwith.addHandler((intent) => {
            if (intent.items.length <= 0) {
                return;
            }
            cordova.openwith.load(intent.items[0],
                async (data, item) => {
                    let stringValue = atob(data);
                    let blob = this.nonAngularObjectsFactory.b64ToBlob(data, item.type) as any;
                    blob.name = "file.twl";
                    if (stringValue.startsWith("PK")) {
                        blob.name = "file.kmz";
                    } else if (stringValue.indexOf("<gpx") !== -1) {
                        blob.name = "file.gpx";
                    } else if (stringValue.indexOf("<kml") !== -1) {
                        blob.name = "file.kml";
                    }
                    try {
                        await this.fileService.addRoutesFromFile(blob);
                    } catch (ex) {
                        this.toastService.error(this.resources.unableToLoadFromFile);
                    }
                });
        });
    }
}