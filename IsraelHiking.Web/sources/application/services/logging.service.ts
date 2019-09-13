/// <reference types="cordova" />
/// <reference types="cordova-plugin-email-composer" />
import { Injectable } from "@angular/core";
import Dexie from "dexie";

import { RunningContextService } from "./running-context.service";

type LogLevel = "debug" | "info" | "error" | "warning";

interface LogLine {
    date: Date;
    message: string;
    level: LogLevel;
}

@Injectable()
export class LoggingService {
    private static readonly LOGGING_TABLE_NAME = "logging";

    private queue: LogLine[];
    private loggingDatabase: Dexie;

    constructor(private readonly runningContextService: RunningContextService) {
        this.queue = [];
        this.loggingDatabase = null;
    }

    public async initialize() {
        if (!this.runningContextService.isCordova) {
            return;
        }
        this.loggingDatabase = new Dexie(LoggingService.LOGGING_TABLE_NAME);
        this.loggingDatabase.version(1).stores({
            logging: "date"
        });
        let threeDaysAgo = new Date((new Date()).getTime() - (3 * 60 * 60 * 24 * 1000));
        let logsToRemove = await this.loggingDatabase.table(LoggingService.LOGGING_TABLE_NAME)
            .where("date").between(new Date(0), threeDaysAgo).toArray() as LogLine[];
        this.loggingDatabase.table(LoggingService.LOGGING_TABLE_NAME).bulkDelete(logsToRemove.map(l => l.date));
        // remove older than 3 days
        while (this.queue.length > 0) {
            this.writeToStorage(this.queue[0]);
            this.queue.splice(0, 1);
        }
    }

    private writeToStorage(logLine: LogLine): void {
        if (!this.runningContextService.isCordova) {
            return;
        }
        if (this.loggingDatabase) {
            this.loggingDatabase.table(LoggingService.LOGGING_TABLE_NAME).add({
                message: logLine.message,
                date: logLine.date,
                level: logLine.level
            });
        } else {
            this.queue.push(logLine);
        }
    }

    public info(message: string) {
        let logLine = {
            date: new Date(),
            level: "info",
            message
        } as LogLine;
        console.log(this.logLineToString(logLine));
        this.writeToStorage(logLine);
    }

    public debug(message: string) {
        let logLine = {
            date: new Date(),
            level: "debug",
            message
        } as LogLine;
        if (!this.runningContextService.isProduction) {
            // tslint:disable-next-line
            console.debug(this.logLineToString(logLine));
        }
        this.writeToStorage(logLine);
    }

    public error(message: string) {
        let logLine = {
            date: new Date(),
            level: "error",
            message
        } as LogLine;
        if (!this.runningContextService.isProduction) {
            console.error(this.logLineToString(logLine));
        }
        this.writeToStorage(logLine);
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
        this.loggingDatabase = null;
    }

    public async emailLog() {
        let logLine = await this.loggingDatabase.table(LoggingService.LOGGING_TABLE_NAME).toArray();
        let body = logLine.map(l => this.logLineToString(l)).join("\n");
        if (this.runningContextService.isCordova) {
            cordova.plugins.email.open({
                to: ["israelhikingmap@gmail.com"],
                subject: "Issue reported by user",
                body
            });
        }
    }

    private logLineToString(logLine: LogLine) {
        let dateString = new Date(logLine.date.getTime() - (logLine.date.getTimezoneOffset() * 60 * 1000))
            .toISOString().replace(/T/, " ").replace(/\..+/, "");
        return dateString + " | " + logLine.level.padStart(5).toUpperCase() + " | " + logLine.message;
    }
}
