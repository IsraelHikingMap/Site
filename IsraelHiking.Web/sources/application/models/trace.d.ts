import { DataContainer } from "./models";

export type TraceVisibility = "private" | "public" | "local" | "identifiable";

export interface Trace {
    id: string;
    name: string;
    description: string;
    url: string;
    imageUrl: string;
    
    timeStamp: Date;
    tagsString: string;
    visibility: TraceVisibility;
    dataContainer?: DataContainer;
}