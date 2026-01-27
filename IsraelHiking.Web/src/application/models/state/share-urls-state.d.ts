import type { ShareUrl } from "..";

export type ShareUrlsState = {
    shareUrls: ShareUrl[];
    /**
     * Shares last modified date
     */
    shareUrlsLastModifiedDate: Date;
};
