export type FileNameDateVersion = {
    fileName: string;
    date: string;
    version?: string;
}

export type OfflineState = {
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
    /**
     * The tile whose files the native background download is downloading, with all the files it needs, until they
     * were moved to where the app reads them from - a download the app did not see end is finished on its next start
     */
    tileDownloadInProgress: { tileX: number; tileY: number; files: FileNameDateVersion[] } | null;
};
