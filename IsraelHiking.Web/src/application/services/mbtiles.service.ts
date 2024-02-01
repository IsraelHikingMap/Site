import { Injectable } from "@angular/core";
import { gunzipSync } from "fflate";

import { CapacitorSQLite, SQLiteDBConnection, SQLiteConnection} from "@capacitor-community/sqlite";
import { RunningContextService } from "./running-context.service";
import { LoggingService } from "./logging.service";

// HM TODO: remove this class in 6.2024 and all code related to sqlite
@Injectable()
export class MBTilesService {
    private sourceDatabases: Map<string, Promise<SQLiteDBConnection>>;
    private sqlite: SQLiteConnection;

    constructor(private readonly runningContext: RunningContextService,
        private readonly loggingService: LoggingService) {
        this.sourceDatabases = new Map<string, Promise<SQLiteDBConnection>>();
    }

    public initialize() {
        if (this.runningContext.isCapacitor) {
            this.sqlite = new SQLiteConnection(CapacitorSQLite);
        }
    }

    public async uninitialize() {
        for (const dbKey of this.sourceDatabases.keys()) {
            await this.closeDatabase(dbKey);
        }
    }

    private async closeDatabase(dbKey: string) {
        this.loggingService.info("[MBTiles] Closing " + dbKey);
        if (!this.sourceDatabases.has(dbKey)) {
            this.loggingService.info(`[MBTiles] ${dbKey} was never opened`);
            return;
        }
        try {
            const db = await this.sourceDatabases.get(dbKey);
            await db.close();
            this.loggingService.info("[MBTiles] Closed succefully: " + dbKey);
            await this.sqlite.closeConnection(dbKey + ".db", true);
            this.loggingService.info("[MBTiles] Connection closed succefully: " + dbKey);
            this.sourceDatabases.delete(dbKey);
        } catch (ex) {
            this.loggingService.error(`[MBTiles] Unable to close ${dbKey}, ${(ex as Error).message}`);
        }
    }

    private async getDatabase(dbName: string): Promise<SQLiteDBConnection> {
        if (this.sourceDatabases.has(dbName)) {
            try {
                const db = await this.sourceDatabases.get(dbName);
                return db;
            } catch (ex) {
                this.loggingService.error(`[MBTiles] There's a problem with the connection to ${dbName}, ${(ex as Error).message}`);
            }
        }
        this.loggingService.info(`[MBTiles] Creating connection to ${dbName}`);
        this.sourceDatabases.set(dbName, this.createConnection(dbName));
        return this.sourceDatabases.get(dbName);
    }

    private async createConnection(dbName: string) {
        try {
            const dbPromise = this.sqlite.createConnection(dbName + ".db", false, "no-encryption", 1, true);
            const db = await dbPromise;
            this.loggingService.info(`[MBTiles] Connection created succefully to ${dbName}`);
            await db.open();
            this.loggingService.info(`[MBTiles] Connection opened succefully: ${dbName}`);
            return db;
        } catch (ex) {
            this.loggingService.error(`[MBTiles] Failed opening ${dbName}, ${(ex as Error).message}`);
            throw ex;
        }
    }

    private async getTileFromDatabase(dbName: string, z: number, x: number, y: number): Promise<ArrayBuffer> {
        const db = await this.getDatabase(dbName);

        const params = [z, x, Math.pow(2, z) - y - 1];
        const queryresults = await db.query("SELECT HEX(tile_data) as tile_data_hex FROM tiles " +
                "WHERE zoom_level = ? AND tile_column = ? AND tile_row = ? limit 1",
                params);
        if (queryresults.values.length !== 1) {
            throw new Error("Unable to get tile from database");
        }
        const hexData = queryresults.values[0].tile_data_hex;
        let binData = new Uint8Array(hexData.match(/.{1,2}/g).map((byte: string) => parseInt(byte, 16)));
        const isGzipped = binData[0] === 0x1f && binData[1] === 0x8b;
        if (isGzipped) {
            binData = gunzipSync(binData);
        }
        return binData.buffer;
    }

    private getSourceNameFromUrl(url: string) {
        return url.replace("custom://", "").split("/")[0];
    }

    public getTile(url: string): Promise<ArrayBuffer> {
        const splitUrl = url.split("/");
        const dbName = this.getSourceNameFromUrl(url);
        const z = +splitUrl[splitUrl.length - 3];
        const x = +splitUrl[splitUrl.length - 2];
        const y = +(splitUrl[splitUrl.length - 1].split(".")[0]);

        return this.getTileFromDatabase(dbName, z, x, y);
    }
}