import { HttpErrorResponse } from "@angular/common/http";
import { Injectable } from "@angular/core";
import Dexie from "dexie";

import { environment } from "../../environments/environment";

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
    private logToConsole: boolean;
    private deletingLogsInProgress = false;

    public async initialize(logToConsole = true) {
        this.loggingDatabase = new Dexie(LoggingService.LOGGING_DB_NAME);
        this.loggingDatabase.version(1).stores({
            logging: "++, date"
        });
        this.logToConsole = logToConsole;
    }

    public uninitialize() {
        this.loggingDatabase.close();
    }

    private async reduceStoredLogLinesIfNeeded() {
        if (this.deletingLogsInProgress) {
            return;
        }
        const lines = await this.loggingDatabase.table(LoggingService.LOGGING_TABLE_NAME).count();
        if (lines <= LoggingService.MAX_LOG_LINES) {
            return;
        }
        const keysToDelete = await this.loggingDatabase.table(LoggingService.LOGGING_TABLE_NAME)
            .orderBy("date")
            .primaryKeys();
        // keep only last MAX_LOG_LINES - 10% to reduce the need to do it every time.
        keysToDelete.splice(keysToDelete.length - LoggingService.MAX_LOG_LINES, LoggingService.MAX_LOG_LINES * 0.9);       
        this.deletingLogsInProgress = true;
        try {
            await this.loggingDatabase.table(LoggingService.LOGGING_TABLE_NAME).bulkDelete(keysToDelete);
        } finally {
            this.deletingLogsInProgress = false;
        }
    }

    private writeToStorage(logLine: LogLine): void {
        this.loggingDatabase.table(LoggingService.LOGGING_TABLE_NAME).add({
            message: logLine.message,
            date: logLine.date,
            level: logLine.level
        }).then(() => this.reduceStoredLogLinesIfNeeded());
    }

    public info(message: string) {
        const logLine = {
            date: new Date(),
            level: "info",
            message
        } as LogLine;
        if (this.logToConsole) console.log(this.logLineToString(logLine));
        this.writeToStorage(logLine);
    }

    public debug(message: string) {
        const logLine = {
            date: new Date(),
            level: "debug",
            message
        } as LogLine;
        if (!environment.production && this.logToConsole) {
            // eslint-disable-next-line
            console.debug(this.logLineToString(logLine));
        }
        this.writeToStorage(logLine);
    }

    public error(message: string) {
        const logLine = {
            date: new Date(),
            level: "error",
            message
        } as LogLine;
        if (this.logToConsole) console.error(this.logLineToString(logLine));
        this.writeToStorage(logLine);
    }

    public warning(message: string) {
        const logLine = {
            date: new Date(),
            level: "warn",
            message
        } as LogLine;
        if (this.logToConsole) console.warn(this.logLineToString(logLine));
        this.writeToStorage(logLine);
    }


    public async getLog(): Promise<string> {
        const lines = await this.loggingDatabase.table(LoggingService.LOGGING_TABLE_NAME)
            .orderBy("date")
            .reverse().limit(LoggingService.MAX_LOG_LINES).toArray();
        return lines.map(l => this.logLineToString(l)).join("\n");
    }

    private logLineToString(logLine: LogLine) {
        const dateString = new Date(logLine.date.getTime() - (logLine.date.getTimezoneOffset() * 60 * 1000))
            .toISOString().replace(/T/, " ").replace(/\..+/, "");
        return dateString + " | " + logLine.level.padStart(5).toUpperCase() + " | " + logLine.message;
    }

    public getErrorTypeAndMessage(ex: any): ErrorTypeAndMessage {
        const typeAndMessage = {
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
