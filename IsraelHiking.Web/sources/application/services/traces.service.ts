import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Subject } from "rxjs";
import * as _ from "lodash";

import { DataContainer } from "../models/models";
import { Urls } from "../urls";


export type Visibility = "private" | "public";

export interface ITrace {
    name: string;
    user: string;
    description: string;
    url: string;
    imageUrl: string;
    dataUrl: string;
    id: string;
    timeStamp: Date;
    tags: string[];
    tagsString: string;
    visibility: Visibility;
    isInEditMode: boolean;
}

@Injectable()
export class TracesService {

    public readOnlyDataContainer: DataContainer;
    public missingParts: GeoJSON.FeatureCollection<GeoJSON.LineString>;

    public traces: ITrace[];
    public tracesChanged: Subject<any>;

    constructor(private readonly httpClient: HttpClient, ) {
        this.traces = [];
        this.tracesChanged = new Subject();
    }

    public getMissingParts(trace: ITrace): Promise<GeoJSON.FeatureCollection<GeoJSON.LineString>> {
        return this.httpClient.post(Urls.osm + "?url=" + trace.dataUrl, {})
            .toPromise() as Promise<GeoJSON.FeatureCollection<GeoJSON.LineString>>;
    }

    public getTraces = async (): Promise<any> => {
        try {
            let response = await this.httpClient.get(Urls.osmTrace).toPromise() as ITrace[];
            this.traces.splice(0);
            let files = ([] as ITrace[]).concat(response || []);
            for (let traceJson of files) {
                let url = `https://www.openstreetmap.org/user/${traceJson.user}/traces/${traceJson.id}`;
                let dataUrl = `https://www.openstreetmap.org/api/0.6/gpx/${traceJson.id}/data`;
                traceJson.url = url;
                traceJson.tagsString = traceJson.tags && traceJson.tags.length > 0 ? traceJson.tags.join(", ") : "";
                traceJson.imageUrl = url + "/picture";
                traceJson.dataUrl = dataUrl;
                traceJson.timeStamp = new Date(traceJson.timeStamp);
                traceJson.isInEditMode = false;
                this.traces.push(traceJson);
            }
            this.tracesChanged.next();
        } catch (ex) {
            console.error("Unable to get user's traces.");
        }
    }

    public updateTrace = (trace: ITrace): Promise<any> => {
        trace.tags = trace.tagsString.split(",").map(t => t.trim()).filter(t => t);
        return this.httpClient.put(Urls.osmTrace + trace.id, trace, { responseType: "text" }).toPromise();
    }

    public deleteTrace = (trace: ITrace): Promise<any> => {
        let promise = this.httpClient.delete(Urls.osmTrace + trace.id, { responseType: "text" }).toPromise();
        promise.then(() => {
            _.remove(this.traces, traceToFind => traceToFind.id === trace.id);
            this.tracesChanged.next();
        });
        return promise;
    }
}