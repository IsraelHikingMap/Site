export type OfflineState = {
    /**
     * Maps last modified date
     */
    lastModifiedDate: Date;
    /**
     * Points of interest last modified date
     */
    poisLastModifiedDate: Date;
    /**
     * Shares last modified date
     */
    shareUrlsLastModifiedDate: Date;
    /**
     * is Offline map downalod is available after license check
     */
    isOfflineAvailable: boolean;
    /**
     * A Queue to represent the IDs of items waiting to be uploaded to the server
     */
    uploadPoiQueue: string[];
    /**
     * Marks if PMTiles were ever downloaded.
     * This flag is used once to allow downloading all the files from the server.
     * It was added 1.2024
     */
    isPmtilesDownloaded: boolean;
};
