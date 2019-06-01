/// <reference types="cordova-plugin-file" />
import { Injectable } from "@angular/core";

import { RunningContextService } from "./running-context.service";
import { ResourcesService } from "./resources.service";
import { LoggingService } from "./logging.service";
import { DatabaseService } from "./database.service";

declare var navigator: Navigator;
declare var cordova: any;
declare var window: Window;

interface Navigator {
    app: any;
}

interface Window {
    plugins: any;
    resolveLocalFileSystemURL: Function;
}

@Injectable()
export class ApplicationExitService {
    constructor(private readonly resources: ResourcesService,
        private readonly databaseService: DatabaseService,
        private readonly runningContext: RunningContextService,
        private readonly loggingService: LoggingService) {
    }

    public initialize() {
        if (!this.runningContext.isCordova) {
            return;
        }

        let exitApp = false;
        let interval = setInterval(() => { exitApp = false; }, 5000);
        document.addEventListener("backbutton", async (e) => {
            e.preventDefault();
            if (exitApp) {
                clearInterval(interval);
                if (navigator.app) {
                    this.loggingService.debug("Starting IHM Application Exit");
                    await this.databaseService.close();
                    this.loggingService.debug("Finished IHM Application Exit");
                    if (!this.runningContext.isProduction) {
                        await this.moveLogFile();
                    }
                    navigator.app.exitApp();
                }
            } else {
                exitApp = true;
                window.plugins.toast.showShortBottom(this.resources.clickBackAgainToCloseTheApp);
                history.back();
            }
        }, false);
    }

    private moveLogFile(): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            let folder = device.platform.toUpperCase().indexOf("OS") !== -1
                ? cordova.file.documentsDirectory
                : cordova.file.externalRootDirectory;
            window.resolveLocalFileSystemURL(folder,
                (directoryEntry: DirectoryEntry) => {
                    directoryEntry.getDirectory("IsraelHikingMap",
                        { create: true },
                        dir => {
                            let fullFileName = "log.txt";
                            dir.getFile(fullFileName,
                                { create: false },
                                fileEntry => {
                                    let newFileName = "log_" + new Date().toISOString().split(":").join("-").replace("T", "_") + ".txt";
                                    fileEntry.moveTo(dir, newFileName, resolve, reject);
                                },
                                reject);
                        },
                        reject);
                },
                reject);
        });
    }
}