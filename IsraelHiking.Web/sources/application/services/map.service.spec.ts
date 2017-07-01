import { MapService } from "./MapService";
import { ResourcesService } from "./ResourcesService";
import { GetTextCatalogService } from "./GetTextCatalogService";
import * as Common from "../common/IsraelHiking";
import { GetTextCatalogMockCreator } from "./resources.service.spec";

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
}

describe("MapService", () => {
    var mapMock: MapServiceMockCreator
    beforeEach(() => {
        mapMock = new MapServiceMockCreator();
    });

    afterEach(() => {
        mapMock.destructor();
    })

    it("should initialize leafelt map", () => {
        for (let prop in localStorage) {
            console.log(prop);
            delete localStorage[prop];
        }
        mapMock.destructor();
        mapMock = new MapServiceMockCreator();

        expect(mapMock.mapService.map.getCenter().lat).toBe(31.773);
        expect(mapMock.mapService.map.getCenter().lng).toBe(35.12);
        expect(mapMock.mapService.map.getZoom()).toBe(13);
    });

    it("should set the right direction for the title of a marker", () => {
        let service = mapMock.mapService;
        let marker = L.marker(L.latLng(0, 0));

        service.setMarkerTitle(marker as Common.IMarkerWithTitle, "title", "#ffff00");

        expect(marker.getTooltip).not.toBeNull();
    });
});