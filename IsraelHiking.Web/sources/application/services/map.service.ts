import { Injectable } from "@angular/core";
import { Map } from "openlayers";
import * as _ from "lodash";

import { ResourcesService } from "./resources.service";
import { IconsService } from "./icons.service";
import { LatLngAlt, MarkerData, IMarkerWithTitle, RouteData, RouteSegmentData } from "../models/models";


@Injectable()
export class MapService {
    public map: Map;

    constructor(private readonly resources: ResourcesService) {
        
    }

    public setMap(map: Map) {
        this.map = map;
    }

    public setMarkerTitle(marker: IMarkerWithTitle, data: MarkerData, color: string = "") {
        //HM TODO: set marker title (tooltip)
        //marker.unbindTooltip();
        //let title = data.title || "";
        //marker.title = title;
        //let hasImage = _.some(data.urls, u => u.mimeType.startsWith("image"));
        //if (!title && !hasImage) {
        //    return;
        //}
        //let controlDiv = L.DomUtil.create("div");
        //let lines = title.split("\n");
        //let displayLine = lines[0];
        //if (lines.length > 1 || data.description) {
        //    displayLine += "...";
        //}
        //let element = hasImage
        //    ? L.DomUtil.create("i", "fa icon-camera", controlDiv) :
        //    L.DomUtil.create("div", "", controlDiv);
        //element.style.color = color;
        //element.dir = this.resources.getDirection(displayLine);
        //element.innerHTML = ` ${displayLine}`;
        //marker.bindTooltip(controlDiv, { permanent: true, direction: "bottom", interactive: true } as L.TooltipOptions);
    }

    /**
     * Gourp as many segment coordinates in order for the ant path to look smoother
     * @param segments - the segments to group
     * @returns {} - an array of array of coordinates
     */
    public getGroupedLatLngForAntPath(segments: RouteSegmentData[]): LatLngAlt[][] {
        let groupedLatLngs = [] as LatLngAlt[][];
        let currentGroup = [] as LatLngAlt[];
        for (let segment of segments) {
            if (currentGroup.length === 0) {
                currentGroup = segment.latlngs;
                continue;
            }
            let first = _.first(segment.latlngs);
            let last = _.last(currentGroup);
            if (first.lat === last.lat && first.lng === last.lng) {
                currentGroup = currentGroup.concat(_.drop(segment.latlngs, 1));
                continue;
            }
            groupedLatLngs.push(currentGroup);
            currentGroup = segment.latlngs;
        }
        groupedLatLngs.push(currentGroup);
        return groupedLatLngs;
    }
}
