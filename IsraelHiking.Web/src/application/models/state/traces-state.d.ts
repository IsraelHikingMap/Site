import type { Trace } from "../models";

export type TracesState = {
    visibleTraceId: string;
    missingParts: GeoJSON.FeatureCollection<GeoJSON.LineString>;
    traces: Trace[];
}
