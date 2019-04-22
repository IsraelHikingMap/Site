import { Injectable } from "@angular/core";
import { Map } from "mapbox-gl";

@Injectable()
export class MapService {
    public map: Map;
    public initializationPromise: Promise<void>;

    private resolve: Function;

    constructor() {
        this.initializationPromise = new Promise((resolve) => { this.resolve = resolve; });
    }

    public setMap(map: Map) {
        this.map = map;
        this.resolve();
    }
}
