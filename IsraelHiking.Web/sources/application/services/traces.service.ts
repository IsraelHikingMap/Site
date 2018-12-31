import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { NgRedux } from "@angular-redux/store";

import { Trace, ApplicationState } from "../models/models";
import { Urls } from "../urls";
import { RemoveTraceAction, UpdateTraceAction, AddTraceAction } from "../reducres/traces.reducer";

@Injectable()
export class TracesService {

    constructor(private readonly httpClient: HttpClient,
        private readonly ngRedux: NgRedux<ApplicationState>) {
    }

    public getMissingParts(trace: Trace): Promise<GeoJSON.FeatureCollection<GeoJSON.LineString>> {
        return this.httpClient.post(Urls.osm + "?url=" + trace.dataUrl, {})
            .toPromise() as Promise<GeoJSON.FeatureCollection<GeoJSON.LineString>>;
    }

    public syncTraces = async (): Promise<any> => {
        try {
            let response = await this.httpClient.get(Urls.osmTrace).toPromise() as Trace[];
            let traces = ([] as Trace[]).concat(response || []);
            let existingTraces = this.ngRedux.getState().tracesState.traces;
            for (let trace of existingTraces) {
                // traces' date in the database are saved with strings - converting to object
                trace.timeStamp = new Date(trace.timeStamp);
            }
            for (let traceJson of traces) {
                let url = `https://www.openstreetmap.org/user/${traceJson.user}/traces/${traceJson.id}`;
                let dataUrl = `https://www.openstreetmap.org/api/0.6/gpx/${traceJson.id}/data`;
                traceJson.url = url;
                traceJson.tagsString = traceJson.tags && traceJson.tags.length > 0 ? traceJson.tags.join(", ") : "";
                traceJson.imageUrl = url + "/picture";
                traceJson.dataUrl = dataUrl;
                traceJson.timeStamp = new Date(traceJson.timeStamp);
                traceJson.isInEditMode = false;
                let existingTrace = existingTraces.find(t => t.id === traceJson.id);
                if (existingTrace != null) {
                    traceJson.dataContainer = existingTrace.dataContainer;
                    this.ngRedux.dispatch(new UpdateTraceAction({ traceId: traceJson.id, trace: traceJson }));
                } else {
                    this.ngRedux.dispatch(new AddTraceAction({ trace: traceJson }));
                }
            }
            for (let trace of existingTraces.filter(t => t.visibility !== "local")) {
                if (traces.find(t => t.id === trace.id) == null) {
                    this.ngRedux.dispatch(new RemoveTraceAction({ traceId: trace.id }));
                }
            }
        } catch (ex) {
            console.error("Unable to get user's traces.");
        }
    }

    public updateTrace = async (trace: Trace): Promise<any> => {
        trace.tags = trace.tagsString.split(",").map(t => t.trim()).filter(t => t);
        await this.httpClient.put(Urls.osmTrace + trace.id, trace, { responseType: "text" }).toPromise();
        this.ngRedux.dispatch(new UpdateTraceAction({ traceId: trace.id, trace: trace }));
    }

    public deleteTrace = async (trace: Trace): Promise<any> => {
        if (trace.visibility !== "local") {
            await this.httpClient.delete(Urls.osmTrace + trace.id, { responseType: "text" }).toPromise();
        }
        this.ngRedux.dispatch(new RemoveTraceAction({ traceId: trace.id }));
    }
}