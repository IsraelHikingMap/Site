import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { NgRedux } from "@angular-redux/store";
import { timeout } from "rxjs/operators";

import { LoggingService } from "./logging.service";
import { ResourcesService } from "./resources.service";
import { Urls } from "../urls";
import { RemoveTraceAction, UpdateTraceAction, AddTraceAction } from "../reducres/traces.reducer";
import { Trace, ApplicationState, DataContainer, RouteData } from "../models/models";

@Injectable()
export class TracesService {

    constructor(private readonly resources: ResourcesService,
                private readonly httpClient: HttpClient,
                private readonly loggingService: LoggingService,
                private readonly ngRedux: NgRedux<ApplicationState>) {
    }

    public getMissingParts(traceId: string): Promise<GeoJSON.FeatureCollection<GeoJSON.LineString>> {
        return this.httpClient.post(Urls.osm + "?traceId=" + traceId, null)
            .toPromise() as Promise<GeoJSON.FeatureCollection<GeoJSON.LineString>>;
    }

    public syncTraces = async (): Promise<void> => {
        try {
            let response = await this.httpClient.get(Urls.osmTrace).pipe(timeout(20000)).toPromise() as Trace[];
            let traces = ([] as Trace[]).concat(response || []);
            let existingTraces = this.ngRedux.getState().tracesState.traces;
            for (let trace of existingTraces) {
                // traces' date in the database are saved with strings - converting to object
                trace.timeStamp = new Date(trace.timeStamp);
            }
            for (let traceJson of traces) {
                traceJson.timeStamp = new Date(traceJson.timeStamp);
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
            this.loggingService.error("Unable to get user's traces.");
        }
    }

    public getTraceById(trace: Trace): Promise<DataContainer> {
        return this.httpClient.get(Urls.osmTrace + trace.id).toPromise() as Promise<DataContainer>;
    }

    public uploadTrace(file: File): Promise<any> {
        let formData = new FormData();
        formData.append("file", file, file.name);
        return this.httpClient.post(Urls.osmTrace, formData).toPromise();
    }

    public async uploadRouteAsTrace(route: RouteData): Promise<any> {
        let isDefaultName = route.name.startsWith(this.resources.route) &&
            route.name.replace(this.resources.route, "").trim().startsWith(new Date().toISOString().split("T")[0]);
        return this.httpClient.post(Urls.osmTraceRoute, route, {
            params: { isDefaultName: isDefaultName.toString(), language: this.resources.getCurrentLanguageCodeSimplified() }
        }).toPromise();
    }

    public async updateTrace(trace: Trace): Promise<void> {
        await this.httpClient.put(Urls.osmTrace + trace.id, trace).toPromise();
        this.ngRedux.dispatch(new UpdateTraceAction({ traceId: trace.id, trace }));
    }

    public async deleteTrace(trace: Trace): Promise<void> {
        if (trace.visibility !== "local") {
            await this.httpClient.delete(Urls.osmTrace + trace.id).toPromise();
        }
        this.ngRedux.dispatch(new RemoveTraceAction({ traceId: trace.id }));
    }
}
