import { HttpErrorResponse } from "@angular/common/http";
import { Injectable } from "@angular/core";
import Dexie from "dexie";

import { RunningContextService } from "./running-context.service";

type LogLevel = "debug" | "info" | "error" | "warn";

export type ErrorType = "timeout" | "client" | "server";

export type ErrorTypeAndMessage = {
    type: ErrorType;
    message: string;
    statusCode?: number;
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

    private loggingDatabase: Dexie;

    constructor(private readonly runningContextService: RunningContextService) {
        this.loggingDatabase = null;
    }

    public async initialize() {
        this.loggingDatabase = new Dexie(LoggingService.LOGGING_DB_NAME);
        this.loggingDatabase.version(1).stores({
            logging: "++, date"
        });
    }

    private async reduceStoredLogLinesIfNeeded() {
        let lines = await this.loggingDatabase.table(LoggingService.LOGGING_TABLE_NAME).count();
        if (lines <= LoggingService.MAX_LOG_LINES) {
            return;
        }
        let keysToDelete = await this.loggingDatabase.table(LoggingService.LOGGING_TABLE_NAME)
            .orderBy("date")
            .primaryKeys();
        // keep only last MAX_LOG_LINES - 10% to reduce the need to do it every time.
        keysToDelete.splice(keysToDelete.length - LoggingService.MAX_LOG_LINES, LoggingService.MAX_LOG_LINES * 0.9);
        await this.loggingDatabase.table(LoggingService.LOGGING_TABLE_NAME).bulkDelete(keysToDelete);
    }

    private writeToStorage(logLine: LogLine): void {
        this.loggingDatabase.table(LoggingService.LOGGING_TABLE_NAME).add({
            message: logLine.message,
            date: logLine.date,
            level: logLine.level
        }).then(() => this.reduceStoredLogLinesIfNeeded());
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
            type: "server",
            message: (ex as Error).message
        } as ErrorTypeAndMessage;
        if ((ex as Error).name === "TimeoutError") {
            typeAndMessage.type = "timeout";
        } else if ((ex as HttpErrorResponse).error && (ex as HttpErrorResponse).error.constructor.name === "ProgressEvent") {
            typeAndMessage.type = "client";
        } else {
            typeAndMessage.statusCode = (ex as HttpErrorResponse).status;
        }
        return typeAndMessage;
    }
}
