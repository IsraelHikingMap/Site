import { RoutesService } from "./routes.service";
import { MapServiceMockCreator } from "../../map.service.spec";
import { RouteLayer } from "./route.layer";
import { IRouteLayer } from "./iroute.layer";

describe("RoutesService", () => {
    var routesService: RoutesService;
    var mapServiceMock: MapServiceMockCreator;
    var routeLayerFactory;

    beforeEach(() => {
        mapServiceMock = new MapServiceMockCreator();
        let mockRouteLayer = L.layerGroup([]) as any as IRouteLayer;
        mockRouteLayer.setReadOnlyState = () => {};
        routeLayerFactory = {
            createRouteLayerFromData: () => mockRouteLayer
        }
        routesService = new RoutesService(mapServiceMock.resourcesService, mapServiceMock.mapService, routeLayerFactory);
    });

    afterEach(() => {
        mapServiceMock.destructor();
    });

    it("Should initialize with a single route", () => {
        expect(routesService.routes.length).toBe(1);
    });

    it("Should set route state to edit when adding a route", () => {
        let mockRouteLayer = L.layerGroup([]) as any as IRouteLayer;
        mockRouteLayer.setEditRouteState = () => {};
        spyOn(mockRouteLayer, "setEditRouteState");
        routeLayerFactory.createRouteLayer = () => mockRouteLayer;

        routesService.addRoute(null);

        expect(mockRouteLayer.setEditRouteState).toHaveBeenCalled();
        expect(mapServiceMock.getNumberOfLayers()).toBe(2);
    });
});