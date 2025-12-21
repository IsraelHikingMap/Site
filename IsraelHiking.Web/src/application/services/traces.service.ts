import { inject, Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { timeout } from "rxjs/operators";
import { Store } from "@ngxs/store";
import { firstValueFrom } from "rxjs";
import type { Immutable } from "immer";

import { LoggingService } from "./logging.service";
import { ResourcesService } from "./resources.service";
import { RunningContextService } from "./running-context.service";
import { DatabaseService } from "./database.service";
import { BulkReplaceTracesAction, RemoveTraceAction, UpdateTraceAction } from "../reducers/traces.reducer";
import { Urls } from "../urls";
import type { Trace, ApplicationState, DataContainer, RouteData } from "../models";

type OsmTrace = {
    description: string;
    id: number;
    lat: number;
    lon: number;
    name: string;
    pending: boolean;
    tags: string[];
    timestamp: string;
    uid: number;
    user: string;
    visibility: "identifiable" | "private" | "public" | "trackable";
}

type OsmTraces = {
    traces: OsmTrace[];
}

@Injectable()
export class TracesService {

    private readonly resources = inject(ResourcesService);
    private readonly httpClient = inject(HttpClient);
    private readonly loggingService = inject(LoggingService);
    private readonly runningContextService = inject(RunningContextService);
    private readonly databaseService = inject(DatabaseService);
    private readonly store = inject(Store);

    public getMissingParts(traceId: string): Promise<GeoJSON.FeatureCollection<GeoJSON.LineString>> {
        this.loggingService.info(`[Traces] Getting missing parts for ${traceId}`);
        return firstValueFrom(this.httpClient.post<GeoJSON.FeatureCollection<GeoJSON.LineString>>(Urls.missingParts + "?traceId=" + traceId, null));
    }

    public async initialize(): Promise<void> {
        await this.uploadLocalTracesIfNeeded();
    }

    public async uploadLocalTracesIfNeeded(): Promise<void> {
        const state = this.store.selectSnapshot((s: ApplicationState) => s);
        if (!state.configuration.isAutomaticRecordingUpload) {
            return;
        }
        if (state.userState.userInfo == null) {
            return;
        }
        const localTraces = state.tracesState.traces.filter(t => t.visibility === "local");
        if (localTraces.length === 0) {
            return;
        }
        this.loggingService.info(`[Traces] There are ${localTraces.length} local traces that are about to be uploaded`);
        for (const localTrace of localTraces) {
            await this.uploadRouteAsTrace(localTrace.dataContainer.routes[0]);
            await this.deleteTrace(localTrace);
        }
        this.loggingService.info(`[Traces] Finished uploading ${localTraces.length} local traces to server`);
        await this.syncTraces();
    }

    public async syncTraces(): Promise<void> {
        try {
            this.loggingService.info("[Traces] Starting syncing traces");
            const response = await firstValueFrom(this.httpClient.get<OsmTraces>(Urls.osmGpxFiles).pipe(timeout(20000)));
            this.loggingService.info("[Traces] Got traces from server, updating local store");
            const existingTraces = this.store.selectSnapshot((s: ApplicationState) => s.tracesState).traces;
            const serverTraces = response.traces.map(traceJson => ({
                name: traceJson.name || "",
                description: traceJson.description || "",
                id: traceJson.id.toString(),
                tagsString: (traceJson.tags || []).join(","),
                timeStamp: traceJson.timestamp ? new Date(traceJson.timestamp) : new Date(),
                visibility: traceJson.visibility,
                url: Urls.osmBase + `/user/${traceJson.user}/traces/${traceJson.id}`,
                imageUrl: Urls.tracePicture + traceJson.id + "/picture"
            } as Trace));
            const allTraces = serverTraces.concat(existingTraces.filter(t => t.visibility === "local") as any as Trace[]);
            const serverTracesMap = serverTraces.reduce((acc, trace) => {
                acc[trace.id] = trace;
                return acc;
            }, {} as { [key: string]: Trace });
            this.store.dispatch(new BulkReplaceTracesAction(allTraces));
            for (const existingTrace of existingTraces.filter(t => t.visibility !== "local" && serverTracesMap[t.id] == null)) {
                this.databaseService.deleteTraceById(existingTrace.id); // no need to wait.
            }
            this.adjustTracesVisibility(serverTraces);
            this.loggingService.info("[Traces] Finished syncing traces");
        } catch (ex) {
            this.loggingService.error("[Traces] Unable to get user's traces. " + (ex as Error).message);
        }
    }

    private adjustTracesVisibility(traces: Trace[]): void {
        for (const trace of traces.filter(t => t.visibility === "private" || t.visibility === "public")) {
            const clonedTrace = structuredClone(trace);
            clonedTrace.visibility = trace.visibility === "private" ? "trackable" : "identifiable";
            this.updateTrace(clonedTrace); // no need to wait.
        }
    }

    public async getTraceById(traceId: string): Promise<Trace> {
        this.loggingService.info(`[Traces] Getting trace by id: ${traceId}`);
        const trace = this.store.selectSnapshot((s: ApplicationState) => s.tracesState).traces.find(t => t.id === traceId);
        if (trace == null) {
            return null;
        }
        const storedTrace = await this.databaseService.getTraceById(traceId);
        if (storedTrace != null) {
            this.loggingService.info(`[Traces] Got trace from database: ${traceId}`);
            return {
                ...trace,
                dataContainer: storedTrace.dataContainer
            };
        }
        const traceFromState = this.store.selectSnapshot((s: ApplicationState) => s.tracesState).traces.find(t => t.id === traceId);
        if (traceFromState != null && traceFromState.dataContainer != null) {
            this.loggingService.info(`[Traces] Got trace from state: ${traceId}`);
            return {
                ...trace,
                dataContainer: structuredClone(traceFromState.dataContainer) as DataContainer
            };
        }

        const dataContainer = await firstValueFrom(this.httpClient.get<DataContainer>(Urls.traceAsDataContainer + traceId));
        this.loggingService.info(`[Traces] Got trace from server: ${traceId}`);
        const traceToStore = {
            ...trace,
            dataContainer
        };
        await this.databaseService.storeTrace(traceToStore);
        return traceToStore;
    }

    public uploadTrace(file: File): Promise<any> {
        const formData = new FormData();
        formData.append("file", file, file.name);
        const filenameWithoutExtension = file.name.split(".");
        filenameWithoutExtension.pop();
        formData.append("description", filenameWithoutExtension.join("."));
        formData.append("visibility", "trackable");
        this.loggingService.info(`[Traces] Uploading a trace with file name ${file.name}`);
        return firstValueFrom(this.httpClient.post(Urls.osmGpx, formData).pipe(timeout(3 * 60 * 1000)));
    }

    public async uploadRouteAsTrace(route: Immutable<RouteData>): Promise<any> {
        this.loggingService.info(`[Traces] Uploading a route as trace with name ${route.name}`);
        return firstValueFrom(this.httpClient.post(Urls.uploadDataContainer, route, {
            params: { language: this.resources.getCurrentLanguageCodeSimplified() }
        }).pipe(timeout(3 * 60 * 1000)));
    }

    public async updateTrace(trace: Trace): Promise<void> {
        this.loggingService.info(`[Traces] Updating a trace with id ${trace.id}, visibility: ${trace.visibility}`);
        if (trace.visibility !== "local") {
            const xmlTreace = `<?xml version="1.0" encoding="UTF-8"?>
<osm version="0.6" generator="OpenStreetMap server">
	<gpx_file id="${trace.id}" name="${trace.name}" visibility="${trace.visibility}" timestamp="${trace.timeStamp.toISOString()}">
		<description>${trace.description}</description>
        ${trace.tagsString.split(",").filter(t => t).map(tag => `<tag>${tag}</tag>`).join("\n")}
	</gpx_file>
</osm>`
            await firstValueFrom(this.httpClient.put(Urls.osmGpx + "/" + trace.id, xmlTreace));
        }
        this.store.dispatch(new UpdateTraceAction(trace));
    }

    public async deleteTrace(trace: Immutable<Trace>): Promise<void> {
        this.loggingService.info(`[Traces] Deleting a trace with name ${trace.name} and id ${trace.id}, visibility: ${trace.visibility}`);
        if (trace.visibility !== "local") {
            await firstValueFrom(this.httpClient.delete(Urls.osmGpx + "/" + trace.id));
        }
        this.store.dispatch(new RemoveTraceAction(trace.id));
        await this.databaseService.deleteTraceById(trace.id);
    }
}
