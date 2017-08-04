import { TestBed } from "@angular/core/testing";

import { HoverHandler } from "./hover-handler";
import {MapServiceMockCreator} from "../../../services/map.service.spec";

describe("HoverHandler", () => {
    var context;
    var hoverHandler: HoverHandler;
    var mapServiceMockCreator: MapServiceMockCreator;
    var middleMarker: L.Marker;
    
    beforeEach(() => {
        mapServiceMockCreator = new MapServiceMockCreator();
        middleMarker = L.marker([0, 0]);
        context = {
            route: {
                properties: {
                    pathOptions: {
                        opacity: 1
                    }
                }
            },
            mapService: mapServiceMockCreator.mapService
        };
        hoverHandler = new HoverHandler(context, middleMarker);
    });

    afterEach(() => {
        mapServiceMockCreator.destructor();
    });
    
    it("Should initialize with None state", () => {
        expect(hoverHandler.getState()).toBe(HoverHandler.NONE);
    });

    it("Should be hidden when on marker", () => {
        hoverHandler.setState(HoverHandler.ON_MARKER);

        let layersNumber = 0;
        context.mapService.map.eachLayer(() => layersNumber++);
        expect(layersNumber).toBe(0);
    });

    it("Should be show middle marker when on polyline", () => {
        hoverHandler.setState(HoverHandler.ON_POLYLINE);

        let layersNumber = 0;
        context.mapService.map.eachLayer(() => layersNumber++);
        expect(layersNumber).toBe(1);
    });

    it("Should be show show line and marker when in add point state", () => {
        hoverHandler.setState(HoverHandler.ADD_POINT);

        let layersNumber = 0;
        context.mapService.map.eachLayer(() => layersNumber++);
        expect(layersNumber).toBe(3); // including svg layer for marker icon
    });
});