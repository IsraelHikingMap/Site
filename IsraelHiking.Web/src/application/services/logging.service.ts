import { HttpErrorResponse } from "@angular/common/http";
import { Injectable } from "@angular/core";
import Dexie from "dexie";

import { RunningContextService } from "./running-context.service";

type LogLevel = "debug" | "info" | "error" | "warn";

export type ErrorType = "timeout" | "client" | "server";

export type ErrorTypeAndMessage = {
    type: ErrorType;
    message: string;
};

interface LogLine {
    date: Date;
    message: string;
    level: LogLevel;
}

@Injectable()
export class LoggingService {
    private static readonly LOGGING_DB_NAME = "Logging";
    private static readonly LOGGING_TABLE_NAME = "logging";
    private static readonly MAX_LOG_LINES = 50000;

    private queue: LogLine[];
    private loggingDatabase: Dexie;

    constructor(private readonly runningContextService: RunningContextService) {
        this.queue = [];
        this.loggingDatabase = null;
    }

    public async initialize() {
        this.loggingDatabase = new Dexie(LoggingService.LOGGING_DB_NAME);
        this.loggingDatabase.version(1).stores({
            logging: "++, date"
        });
        let lines = await this.loggingDatabase.table(LoggingService.LOGGING_TABLE_NAME).count();
        if (lines > LoggingService.MAX_LOG_LINES) {
            // keep only last MAX_LOG_LINES
            await this.loggingDatabase.table(LoggingService.LOGGING_TABLE_NAME)
                .orderBy("date")
                .reverse()
                .offset(LoggingService.MAX_LOG_LINES)
                .delete();
        }

        while (this.queue.length > 0) {
            this.writeToStorage(this.queue[0]);
            this.queue.splice(0, 1);
        }
    }

    private writeToStorage(logLine: LogLine): void {
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
            // eslint-disable-next-line
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
        console.error(this.logLineToString(logLine));
        this.writeToStorage(logLine);
    }

    public warning(message: string) {
        let logLine = {
            date: new Date(),
            level: "warn",
            message
        } as LogLine;
        console.warn(this.logLineToString(logLine));
        this.writeToStorage(logLine);
    }

    public async uninitialize(): Promise<void> {
        if (this.runningContextService.isProduction) {
            return;
        }
        let checkQueuePromise = new Promise<void>((resolve, _) => {
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

    public async getLog(): Promise<string> {
        let lines = await this.loggingDatabase.table(LoggingService.LOGGING_TABLE_NAME)
            .orderBy("date")
            .reverse().limit(LoggingService.MAX_LOG_LINES).toArray();
        return lines.map(l => this.logLineToString(l)).join("\n");
    }

    private logLineToString(logLine: LogLine) {
        let dateString = new Date(logLine.date.getTime() - (logLine.date.getTimezoneOffset() * 60 * 1000))
            .toISOString().replace(/T/, " ").replace(/\..+/, "");
        return dateString + " | " + logLine.level.padStart(5).toUpperCase() + " | " + logLine.message;
    }

    public getErrorTypeAndMessage(ex: any): ErrorTypeAndMessage {
        let typeAndMessage = {
            type: "server" as ErrorType,
            message: (ex as Error).message
        };
        if ((ex as Error).name === "TimeoutError") {
            typeAndMessage.type = "timeout";
        } else if ((ex as HttpErrorResponse).error && (ex as HttpErrorResponse).error.constructor.name === "ProgressEvent") {
            typeAndMessage.type = "client";
        }
        return typeAndMessage;
    }
}
