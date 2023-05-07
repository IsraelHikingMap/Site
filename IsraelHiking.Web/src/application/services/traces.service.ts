import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { timeout } from "rxjs/operators";
import { Store } from "@ngxs/store";
import { firstValueFrom } from "rxjs";

import { LoggingService } from "./logging.service";
import { ResourcesService } from "./resources.service";
import { RunningContextService } from "./running-context.service";
import { DatabaseService } from "./database.service";
import { AddTraceAction, RemoveTraceAction, UpdateTraceAction } from "../reducers/traces.reducer";
import { Urls } from "../urls";
import type { Trace, ApplicationState, DataContainer, RouteData } from "../models/models";

@Injectable()
export class TracesService {

    constructor(private readonly resources: ResourcesService,
                private readonly httpClient: HttpClient,
                private readonly loggingService: LoggingService,
                private readonly runningContextService: RunningContextService,
                private readonly databaseService: DatabaseService,
                private readonly store: Store) {
    }

    public getMissingParts(traceId: string): Promise<GeoJSON.FeatureCollection<GeoJSON.LineString>> {
        this.loggingService.info(`[Traces] Getting missing parts for ${traceId}`);
        let missingParts$ = this.httpClient.post(Urls.osm + "?traceId=" + traceId, null);
        return firstValueFrom(missingParts$) as Promise<GeoJSON.FeatureCollection<GeoJSON.LineString>>;
    }

    public async initialize(): Promise<void> {
        await this.uploadLocalTracesIfNeeded();
    }

    public async uploadLocalTracesIfNeeded(): Promise<void> {
        let state = this.store.snapshot() as ApplicationState;
        if (!state.configuration.isAutomaticRecordingUpload) {
            return;
        }
        if (!this.runningContextService.isOnline) {
            return;
        }
        if (state.userState.userInfo == null) {
            return;
        }
        let localTraces = state.tracesState.traces.filter(t => t.visibility === "local");
        if (localTraces.length === 0) {
            return;
        }
        this.loggingService.info(`[Traces] There are ${localTraces.length} local traces that are about to be uploaded`);
        for (let localTrace of localTraces) {
            await this.uploadRouteAsTrace(localTrace.dataContainer.routes[0]);
            await this.deleteTrace(localTrace);
        }
        this.loggingService.info(`[Traces] Finished uploading ${localTraces.length} local traces to server`);
        await this.syncTraces();
    }

    public async syncTraces(): Promise<void> {
        try {
            this.loggingService.info("[Traces] Starting syncing traces");
            let response = await firstValueFrom(this.httpClient.get(Urls.osmTrace).pipe(timeout(20000)));
            let traces = ([] as Trace[]).concat(response as Trace[] || []);
            let existingTraces = this.store.selectSnapshot((s: ApplicationState) => s.tracesState).traces;
            for (let traceJson of traces) {
                traceJson.timeStamp = new Date(traceJson.timeStamp);
                let existingTrace = existingTraces.find(t => t.id === traceJson.id);
                if (existingTrace != null) {
                    this.store.dispatch(new UpdateTraceAction(traceJson.id, traceJson));
                } else {
                    this.store.dispatch(new AddTraceAction(traceJson));
                }
                if (traceJson.visibility === "private") {
                    traceJson.visibility = "trackable";
                    this.updateTrace(traceJson);
                }
                if (traceJson.visibility === "public") {
                    traceJson.visibility = "identifiable";
                    this.updateTrace(traceJson);
                }
            }
            for (let trace of existingTraces.filter(t => t.visibility !== "local")) {
                if (traces.find(t => t.id === trace.id) == null) {
                    this.store.dispatch(new RemoveTraceAction(trace.id));
                    await this.databaseService.deleteTraceById(trace.id);
                }
            }
            this.loggingService.info("[Traces] Finished syncing traces");
        } catch (ex) {
            this.loggingService.error("[Traces] Unable to get user's traces. " + (ex as Error).message);
        }
    }

    public async getTraceById(traceId: string): Promise<Trace> {
        this.loggingService.info(`[Traces] Getting trace by id: ${traceId}`);
        let trace = this.store.selectSnapshot((s: ApplicationState) => s.tracesState).traces.find(t => t.id === traceId);
        if (trace == null) {
            return null;
        }
        let storedTrace = await this.databaseService.getTraceById(traceId);
        if (storedTrace != null) {
            this.loggingService.info(`[Traces] Got trace from database: ${traceId}`);
            return {
                ...trace,
                dataContainer: storedTrace.dataContainer
            };
        }
        let dataContainer = await firstValueFrom(this.httpClient.get(Urls.osmTrace + traceId)) as DataContainer;
        this.loggingService.info(`[Traces] Got trace from server: ${traceId}`);
        trace = {
            ...trace,
            dataContainer
        };
        await this.databaseService.storeTrace(trace);
        return trace;
    }

    public uploadTrace(file: File): Promise<any> {
        let formData = new FormData();
        formData.append("file", file, file.name);
        this.loggingService.info(`[Traces] Uploading a trace with file name ${file.name}`);
        return firstValueFrom(this.httpClient.post(Urls.osmTrace, formData).pipe(timeout(3 * 60 * 1000)));
    }

    public async uploadRouteAsTrace(route: RouteData): Promise<any> {
        this.loggingService.info(`[Traces] Uploading a route as trace with name ${route.name}`);
        return firstValueFrom(this.httpClient.post(Urls.osmTraceRoute, route, {
            params: { language: this.resources.getCurrentLanguageCodeSimplified() }
        }).pipe(timeout(3 * 60 * 1000)));
    }

    public async updateTrace(trace: Trace): Promise<void> {
        this.loggingService.info(`[Traces] Updating a trace with id ${trace.id}`);
        await firstValueFrom(this.httpClient.put(Urls.osmTrace + trace.id, trace));
        this.store.dispatch(new UpdateTraceAction(trace.id, trace));
    }

    public async deleteTrace(trace: Trace): Promise<void> {
        this.loggingService.info(`[Traces] Deleting a trace with name ${trace.name} and id ${trace.id}, visibility: ${trace.visibility}`);
        if (trace.visibility !== "local") {
            await firstValueFrom(this.httpClient.delete(Urls.osmTrace + trace.id));
        }
        this.store.dispatch(new RemoveTraceAction(trace.id));
        await this.databaseService.deleteTraceById(trace.id);
    }
}
