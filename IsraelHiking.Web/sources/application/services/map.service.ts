import { Injectable } from "@angular/core";
import { Map } from "ol";

@Injectable()
export class MapService {
    public map: Map;

    public setMap(map: Map) {
        this.map = map;
    }
}
