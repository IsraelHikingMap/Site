import { Trace } from "../models";

export interface TracesState {
    visibleTraceId: string;
    missingParts: GeoJSON.FeatureCollection<GeoJSON.LineString>;
    traces: Trace[];
}
