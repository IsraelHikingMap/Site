/// <reference types="cordova-plugin-device"/>
/// <reference types="cordova-plugin-file"/>
import { Injectable } from "@angular/core";

import { RunningContextService } from "./running-context.service";

declare var cordova: any;

@Injectable()
export class LoggingService {
    private static readonly LOG_FILE_NAME = "log.txt";

    private queue: string[];
    private fileWriter: FileWriter;

    constructor(private readonly runningContextService: RunningContextService) {
        if (!this.runningContextService.isCordova || this.runningContextService.isProduction) {
            return;
        }
        this.queue = [];
        this.fileWriter = null;
        this.getIHMDirectory().then((dir) => {
            let fullFileName = LoggingService.LOG_FILE_NAME;
            dir.getFile(fullFileName,
                { create: true },
                fileEntry => {
                    fileEntry.createWriter(fileWriter => {
                        this.fileWriter = fileWriter;
                        fileWriter.seek(fileWriter.length);
                        this.fileWriter.onwriteend = () => {
                            if (this.queue.length > 0) {
                                this.fileWriter.write(this.queue[0] as any);
                                this.queue.splice(0, 1);
                            }
                        };
                    });
                },
                () => { }
            );
        });
    }

    private writeToFile(message: string): void {
        if (!this.runningContextService.isCordova) {
            return;
        }
        if (this.fileWriter && this.fileWriter.readyState !== FileWriter.WRITING) {
            this.fileWriter.write(message as any);
        } else {
            this.queue.push(message);
        }
    }

    public info(message: string) {
        console.log(message);
        this.writeToFile(new Date().toISOString() + " |  INFO | " + message + "\n");
    }

    public debug(message: string) {
        if (this.runningContextService.isProduction) {
            return;
        }
        // tslint:disable-next-line
        console.debug(message);
        this.writeToFile(new Date().toISOString() + " | DEBUG | " + message + "\n");
    }

    public error(message: string) {
        if (this.runningContextService.isProduction) {
            return;
        }
        console.error(message);
        this.writeToFile(new Date().toISOString() + " | ERROR | " + message + "\n");
    }

    public async close(): Promise<any> {
        if (this.runningContextService.isProduction) {
            return;
        }
        let checkQueuePromise = new Promise((resolve, _) => {
            let checkQueue = () => {
                if (this.queue.length === 0) {
                    resolve();
                    return;
                }
                setTimeout(checkQueue, 100);
            };
            setTimeout(checkQueue, 100);
        });
        await checkQueuePromise;
        this.fileWriter = null;
        await new Promise<any>((resolve, reject) => {
            if (this.queue.length > 0) {
                setTimeout(() => this.close(), 100);
            }
            this.getIHMDirectory().then((dir) => {
                let fullFileName = LoggingService.LOG_FILE_NAME;
                dir.getFile(fullFileName,
                    { create: false },
                    fileEntry => {
                        let newFileName = "log_" + new Date().toISOString().split(":").join("-").replace("T", "_") + ".txt";
                        fileEntry.moveTo(dir, newFileName, resolve, reject);
                    },
                    reject);
            });
        });
    }

    public getIHMDirectory(): Promise<DirectoryEntry> {
        return new Promise((resolve, reject) => {
            let folder = device.platform.toUpperCase().indexOf("OS") !== -1
                ? cordova.file.documentsDirectory
                : cordova.file.externalRootDirectory;
            (window as any).resolveLocalFileSystemURL(folder,
                (directoryEntry) => {
                    directoryEntry.getDirectory("IsraelHikingMap",
                        { create: true },
                        dir => {
                            resolve(dir);
                        }, reject);
                }, resolve);
        });
    }
}