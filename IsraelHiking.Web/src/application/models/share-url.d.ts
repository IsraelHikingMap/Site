import type { DataContainer } from "./models";

export type ShareUrl = {
    id: string;
    title: string;
    description: string;
    osmUserId: string;
    viewsCount: number;
    creationDate: Date;
    lastModifiedDate: Date;
    dataContainer: DataContainer;
    base64Preview: string;
};
