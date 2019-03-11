/// <reference types="cordova-plugin-device"/>
import { Injectable } from "@angular/core";

import { RunningContextService } from "./running-context.service";

declare var cordova: any;

@Injectable()
export class LoggingService {
    constructor(private readonly runningContextService: RunningContextService) {
    }

    private writeToFile(message: string): Promise<boolean> {
        return new Promise((resolve, reject) => {
            if (!this.runningContextService.isCordova) {
                resolve();
                return;
            }
            let folder = device.platform.toUpperCase().indexOf("OS") !== -1
                ? cordova.file.documentsDirectory
                : cordova.file.externalRootDirectory;
            (window as any).resolveLocalFileSystemURL(folder,
                (directoryEntry) => {
                    directoryEntry.getDirectory("IsraelHikingMap",
                        { create: true },
                        dir => {
                            let fullFileName = "log.txt";
                            dir.getFile(fullFileName,
                                { create: true },
                                fileEntry => {
                                    fileEntry.createWriter(fileWriter => {
                                        fileWriter.seek(fileWriter.length);
                                        fileWriter.write(message);
                                        resolve(true);
                                    });
                                },
                                reject);
                        },
                        reject);
                },
                reject);
        });
    }

    public async log(message: string) {
        console.log(message);
        await this.writeToFile(new Date().toISOString() + " |  INFO | " + message + "\n");
    }

    public async debug(message: string) {
        if (this.runningContextService.isProduction) {
            return;
        }
        console.log(message);
        await this.writeToFile(new Date().toISOString() + " | DEBUG | " + message + "\n");
    }
}