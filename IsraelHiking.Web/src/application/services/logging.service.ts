import { HttpErrorResponse } from "@angular/common/http";
import { Service } from "@angular/core";
import Dexie from "dexie";

import { environment } from "../../environments/environment";

type LogLevel = "debug" | "info" | "error" | "warn";

/**
 * Logs are split into channels, each stored in its own table and trimmed on its own, so that the
 * high volume of GPS and recording lines a long recording produces can't push the general log out.
 */
export type LogChannel = "general" | "gps";

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

@Service()
export class LoggingService {
    private static readonly LOGGING_DB_NAME = "Logging";
    /**
     * Each channel is capped on its own, and the caps together are what a mail provider takes as
     * attachments - 25MB for gmail, which base64 reaches at around 18MB of text. Most of that budget
     * goes to the gps channel, whose lines are both longer - around 165 bytes against 120 - and far
     * more frequent: a recording writes two of them for every position it keeps.
     */
    private static readonly CHANNELS: Record<LogChannel, { table: string; maxLogLines: number }> = {
        general: { table: "logging", maxLogLines: 20000 },
        gps: { table: "gpsLogging", maxLogLines: 70000 }
    };

    private loggingDatabase: Dexie;
    private logToConsole: boolean;
    private readonly channelsBeingReduced = new Set<LogChannel>();

    public async initialize(logToConsole = true) {
        this.loggingDatabase = new Dexie(LoggingService.LOGGING_DB_NAME);
        this.loggingDatabase.version(2).stores({
            logging: "++, date",
            gpsLogging: "++, date"
        });
        this.logToConsole = logToConsole;
    }

    private async reduceStoredLogLinesIfNeeded(channel: LogChannel) {
        if (this.channelsBeingReduced.has(channel)) {
            return;
        }
        const { table, maxLogLines } = LoggingService.CHANNELS[channel];
        const lines = await this.loggingDatabase.table(table).count();
        if (lines <= maxLogLines) {
            return;
        }
        const keysToDelete = await this.loggingDatabase.table(table)
            .orderBy("date")
            .primaryKeys();
        // keep only the newest maxLogLines - 10% to reduce the need to do it every time.
        const linesToKeep = maxLogLines * 0.9;
        keysToDelete.splice(keysToDelete.length - linesToKeep, linesToKeep);
        this.channelsBeingReduced.add(channel);
        try {
            await this.loggingDatabase.table(table).bulkDelete(keysToDelete);
        } finally {
            this.channelsBeingReduced.delete(channel);
        }
    }

    private async writeToStorage(logLine: LogLine, channel: LogChannel): Promise<void> {
        if (!this.loggingDatabase) {
            return;
        }
        try {
            await this.loggingDatabase.table(LoggingService.CHANNELS[channel].table).add({
                message: logLine.message,
                date: logLine.date,
                level: logLine.level
            });
            await this.reduceStoredLogLinesIfNeeded(channel);
        } catch {
            // a log line that could not be stored is not worth failing over
        }
    }

    public info(message: string, channel: LogChannel = "general") {
        const logLine = {
            date: new Date(),
            level: "info",
            message
        } as LogLine;
        if (this.logToConsole) console.log(this.logLineToString(logLine));
        this.writeToStorage(logLine, channel);
    }

    public debug(message: string, channel: LogChannel = "general") {
        const logLine = {
            date: new Date(),
            level: "debug",
            message
        } as LogLine;
        if (!environment.production && this.logToConsole) {
             
            console.debug(this.logLineToString(logLine));
        }
        this.writeToStorage(logLine, channel);
    }

    public error(message: string, channel: LogChannel = "general") {
        const logLine = {
            date: new Date(),
            level: "error",
            message
        } as LogLine;
        if (this.logToConsole) console.error(this.logLineToString(logLine));
        this.writeToStorage(logLine, channel);
    }

    public warning(message: string, channel: LogChannel = "general") {
        const logLine = {
            date: new Date(),
            level: "warn",
            message
        } as LogLine;
        if (this.logToConsole) console.warn(this.logLineToString(logLine));
        this.writeToStorage(logLine, channel);
    }


    public async getLog(channel: LogChannel = "general"): Promise<string> {
        const { table, maxLogLines } = LoggingService.CHANNELS[channel];
        const lines = await this.loggingDatabase.table(table)
            .orderBy("date")
            .reverse().limit(maxLogLines).toArray();
        return lines.map(l => this.logLineToString(l)).join("\n");
    }

    private logLineToString(logLine: LogLine) {
        const dateString = new Date(logLine.date.getTime() - (logLine.date.getTimezoneOffset() * 60 * 1000))
            .toISOString().replace(/T/, " ").replace(/\..+/, "");
        return dateString + " | " + logLine.level.padStart(5).toUpperCase() + " | " + logLine.message;
    }

    public getErrorTypeAndMessage(ex: unknown): ErrorTypeAndMessage {
        const typeAndMessage: ErrorTypeAndMessage = {
            type: "server",
            message: (ex as Error).message
        };

        if ((ex as Error).name === "TimeoutError") {
            typeAndMessage.type = "timeout";
        } else if ((ex as HttpErrorResponse).status === 0) {
            typeAndMessage.type = "client";
        } else {
            typeAndMessage.statusCode = (ex as HttpErrorResponse).status;
        }
        return typeAndMessage;
    }
}
