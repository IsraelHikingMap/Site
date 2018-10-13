﻿import * as L from "leaflet";

import { MapService } from "./map.service";
import { ResourcesService } from "./resources.service";
import { GetTextCatalogMockCreator } from "./resources.service.spec";
import { MarkerData, IMarkerWithTitle } from "../models/models";

export class MapServiceMockCreator {
    private mapDiv: HTMLElement;
    public mapService: MapService;
    public resourcesService: ResourcesService;

    public constructor() {
        this.mapDiv = L.DomUtil.create("div", "", document.body);
        this.mapDiv.id = "map";
        let mockCreator = new GetTextCatalogMockCreator();
        this.resourcesService = new ResourcesService(mockCreator.getTextCatalogService);
        this.mapService = new MapService(this.resourcesService);
    }

    public destructor() {
        L.DomUtil.remove(this.mapDiv);
        this.mapDiv = null;
    }

    public getNumberOfLayers(): number {
        let layersNumber = 0;
        this.mapService.map.eachLayer(() => layersNumber++);
        return layersNumber;
    }
}

describe("MapService", () => {
    let mapMock: MapServiceMockCreator;
    beforeEach(() => {
        mapMock = new MapServiceMockCreator();
    });

    afterEach(() => {
        mapMock.destructor();
    });

    it("should initialize leafelt map", () => {
        for (let prop in localStorage) {
            if (localStorage.hasOwnProperty(prop)) {
                delete localStorage[prop];
            }
        }
        mapMock.destructor();
        mapMock = new MapServiceMockCreator();

        expect(mapMock.mapService.map.getCenter().lat).toBe(31.773);
        expect(mapMock.mapService.map.getCenter().lng).toBe(35.12);
        expect(mapMock.mapService.map.getZoom()).toBe(13);
    });

    it("should set the right direction for the title of a marker", () => {
        let service = mapMock.mapService;
        let marker = L.marker(LatLngAlt(0, 0));

        service.setMarkerTitle(marker as IMarkerWithTitle,
            {
                title: "title",
                urls: [{ mimeType: "image/png" }]
            } as MarkerData,
            "#ffff00");

        expect(marker.getTooltip).not.toBeNull();
    });
});