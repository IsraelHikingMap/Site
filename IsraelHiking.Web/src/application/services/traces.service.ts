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
import { AddTraceAction, RemoveTraceAction, UpdateTraceAction } from "../reducers/traces.reducer";
import { Urls } from "../urls";
import type { Trace, ApplicationState, DataContainer, RouteData } from "../models/models";

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
        const missingParts$ = this.httpClient.post(Urls.missingParts + "?traceId=" + traceId, null);
        return firstValueFrom(missingParts$) as Promise<GeoJSON.FeatureCollection<GeoJSON.LineString>>;
    }

    public async initialize(): Promise<void> {
        await this.uploadLocalTracesIfNeeded();
    }

    public async uploadLocalTracesIfNeeded(): Promise<void> {
        const state = this.store.snapshot() as ApplicationState;
        if (!state.configuration.isAutomaticRecordingUpload) {
            return;
        }
        if (!this.runningContextService.isOnline) {
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
            const response = await firstValueFrom(this.httpClient.get(Urls.osmGpxFiles).pipe(timeout(20000))) as unknown as OsmTraces;
            const existingTraces = this.store.selectSnapshot((s: ApplicationState) => s.tracesState).traces;
            for (const traceJson of response.traces) {
                const trace: Trace = {
                    name: traceJson.name || "",
                    description: traceJson.description || "",
                    id: traceJson.id.toString(),
                    tagsString: (traceJson.tags || []).join(","),
                    timeStamp: traceJson.timestamp ? new Date(traceJson.timestamp) : new Date(),
                    visibility: traceJson.visibility,
                    url: Urls.osmBase + `/user/${traceJson.user}/traces/${traceJson.id}`,
                    imageUrl: Urls.tracePicture + traceJson.id + "/picture"
                }
                const existingTrace = existingTraces.find(t => t.id === trace.id);
                if (existingTrace != null) {
                    this.store.dispatch(new UpdateTraceAction(structuredClone(trace)));
                } else {
                    this.store.dispatch(new AddTraceAction(structuredClone(trace)));
                }
                if (trace.visibility === "private") {
                    trace.visibility = "trackable";
                    this.updateTrace(trace);
                }
                if (trace.visibility === "public") {
                    trace.visibility = "identifiable";
                    this.updateTrace(trace);
                }
            }
            for (const existingTrace of existingTraces.filter(t => t.visibility !== "local")) {
                if (response.traces.find(t => t.id.toString() === existingTrace.id) == null) {
                    this.store.dispatch(new RemoveTraceAction(existingTrace.id));
                    await this.databaseService.deleteTraceById(existingTrace.id);
                }
            }
            this.loggingService.info("[Traces] Finished syncing traces");
        } catch (ex) {
            this.loggingService.error("[Traces] Unable to get user's traces. " + (ex as Error).message);
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
        const dataContainer = await firstValueFrom(this.httpClient.get(Urls.traceAsDataContainer + traceId)) as DataContainer;
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
        ${trace.tagsString.split(",").map(tag => `<tag>${tag}</tag>`).join("\n")}
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
