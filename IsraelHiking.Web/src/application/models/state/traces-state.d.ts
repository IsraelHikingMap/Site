import type { Trace } from "..";

export type TracesState = {
    visibleTraceId: string;
    missingParts: GeoJSON.FeatureCollection<GeoJSON.LineString>;
    traces: Trace[];
};
