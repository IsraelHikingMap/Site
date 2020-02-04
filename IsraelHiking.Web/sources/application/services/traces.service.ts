import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { NgRedux } from "@angular-redux/store";

import { Urls } from "../urls";
import { RemoveTraceAction, UpdateTraceAction, AddTraceAction } from "../reducres/traces.reducer";
import { NonAngularObjectsFactory } from "./non-angular-objects.factory";
import { Trace, ApplicationState, DataContainer, RouteData } from "../models/models";

@Injectable()
export class TracesService {

    constructor(private readonly httpClient: HttpClient,
                private readonly nonAngularObjectsFactory: NonAngularObjectsFactory,
                private readonly ngRedux: NgRedux<ApplicationState>) {
    }

    public getMissingParts(trace: Trace): Promise<GeoJSON.FeatureCollection<GeoJSON.LineString>> {
        return this.httpClient.post(Urls.osm + "?traceId=" + trace.id, null)
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

    public getTraceById(trace: Trace): Promise<DataContainer> {
        return this.httpClient.get(Urls.osmTrace + trace.id).toPromise() as Promise<DataContainer>;
    }

    public uploadTrace(file: File): Promise<any> {
        let formData = new FormData();
        formData.append("file", file, file.name);
        return this.httpClient.post(Urls.osmTrace, formData, { responseType: "text" }).toPromise();
    }

    public async uploadRouteAsTrace(route: RouteData): Promise<any> {
        let data = {
            routes: [route]
        } as DataContainer;
        let responseData = await this.httpClient.post(Urls.files + "?format=gpx", data).toPromise() as string;
        let blobToSave = this.nonAngularObjectsFactory.b64ToBlob(responseData, "application/octet-stream");
        let formData = new FormData();
        formData.append("file", blobToSave, route.name + ".gpx");
        return this.httpClient.post(Urls.osmTrace, formData, { responseType: "text" }).toPromise();
    }

    public updateTrace = async (trace: Trace): Promise<any> => {
        await this.httpClient.put(Urls.osmTrace + trace.id, trace, { responseType: "text" }).toPromise();
        this.ngRedux.dispatch(new UpdateTraceAction({ traceId: trace.id, trace }));
    }

    public deleteTrace = async (trace: Trace): Promise<any> => {
        if (trace.visibility !== "local") {
            await this.httpClient.delete(Urls.osmTrace + trace.id, { responseType: "text" }).toPromise();
        }
        this.ngRedux.dispatch(new RemoveTraceAction({ traceId: trace.id }));
    }
}
