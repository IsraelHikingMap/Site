import { DataContainer } from "./models";

export interface ShareUrl {
    id: string;
    title: string;
    description: string;
    osmUserId: string;
    viewsCount: number;
    creationDate: Date;
    dataContainer: DataContainer;
}