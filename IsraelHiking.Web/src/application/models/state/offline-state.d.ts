﻿export interface OfflineState {
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

    isOfflineAvailable: boolean;
    
}