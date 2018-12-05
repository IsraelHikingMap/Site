import { DataContainer } from "./models";

export type TraceVisibility = "private" | "public" | "local" | "identifiable";

export interface Trace {
    name: string;
    user: string;
    description: string;
    url: string;
    imageUrl: string;
    dataUrl: string;
    id: string;
    timeStamp: Date;
    tags: string[];
    tagsString: string;
    visibility: TraceVisibility;
    isInEditMode: boolean;
    dataContainer?: DataContainer;
}