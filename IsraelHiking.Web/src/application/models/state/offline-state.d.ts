export type FileNameDateVersion = {
    fileName: string;
    date: string;
    version?: string;
}

export type TileMetadataPerFile = Date | FileNameDateVersion[];

export type OfflineState = {
    /**
     * The downloaded tiles, key is the tile id and value is the date it was downloaded
     */
    downloadedTiles: Record<string, TileMetadataPerFile>;
    /**
     * `true` after a user made a purchase of the subscription 
     */
    isSubscribed: boolean;
    /**
     * A Queue to represent the IDs of items waiting to be uploaded to the server
     */
    uploadPoiQueue: string[];
    /**
     * The last time the app detected that the user is offline
     */
    lastOfflineDetectedDate: Date | null;
};
