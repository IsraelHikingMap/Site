export type OfflineState = {
    /**
     * The downloaded tiles, key is the tile id and value is the date it was downloaded
     */
    downloadedTiles: Record<string, Date>;
    /**
     * Shares last modified date
     */
    shareUrlsLastModifiedDate: Date;
    /**
     * `true` after a user made a purchase of the subscription 
     */
    isSubscribed: boolean;
    /**
     * A Queue to represent the IDs of items waiting to be uploaded to the server
     */
    uploadPoiQueue: string[];
};
