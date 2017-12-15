import * as L from "leaflet";

import { RoutesService } from "./routes.service";
import { MapServiceMockCreator } from "../../map.service.spec";
import { IRouteLayer, IRoute, IRouteSegment } from "./iroute.layer";

describe("RoutesService", () => {
    var routesService: RoutesService;
    var mapServiceMock: MapServiceMockCreator;
    var routeLayerFactory;
    var initialRouteLayer: IRouteLayer;

    beforeEach(() => {
        mapServiceMock = new MapServiceMockCreator();
        initialRouteLayer = L.layerGroup([]) as any as IRouteLayer;
        initialRouteLayer.route = {
            properties: {
                name: "name"
            }
        } as IRoute;
        initialRouteLayer.setReadOnlyState = () => { };
        initialRouteLayer.setEditRouteState = () => { };
        routeLayerFactory = {
            createRouteLayerFromData: () => initialRouteLayer,
            createRouteLayer: () => initialRouteLayer
        };
        routesService = new RoutesService(mapServiceMock.resourcesService, mapServiceMock.mapService, routeLayerFactory);
    });

    afterEach(() => {
        mapServiceMock.destructor();
    });

    it("Should initialize with a single selected route", () => {
        expect(routesService.routes.length).toBe(0);
        expect(routesService.selectedRoute).toBe(null);
    });

    it("Should set route state to edit when adding a route", () => {
        let mockRouteLayer = L.layerGroup([]) as any as IRouteLayer;
        mockRouteLayer.setEditRouteState = () => { };
        spyOn(mockRouteLayer, "setEditRouteState");
        routeLayerFactory.createRouteLayer = () => mockRouteLayer;

        routesService.addRoute(null);

        expect(mockRouteLayer.setEditRouteState).toHaveBeenCalled();
        expect(routesService.routes.length).toBe(1);
    });

    it("Should not remove route if the name is not in the list", () => {
        routesService.removeRoute("not name");

        expect(routesService.routes.length).toBe(0);
    });

    it("Should remove selected route by name and set selected route to null", () => {
        routesService.removeRoute("name");

        expect(routesService.routes.length).toBe(0);
        expect(routesService.selectedRoute).toBeNull();
    });

    it("Should know if a name is availble or nor", () => {
        expect(routesService.isNameAvailable("not name")).toBeTruthy();
    });

    it("Should remove a selected route from the map when changing its state", () => {
        initialRouteLayer.route.properties.isVisible = true;
        routesService.addRoute(null);
        spyOn(mapServiceMock.mapService.map, "removeLayer");

        routesService.changeRouteState(initialRouteLayer);

        expect(routesService.selectedRoute).toBeNull();
        expect(mapServiceMock.mapService.map.removeLayer).toHaveBeenCalled();
    });

    it("Should add a hidden route to the map when changing its state", () => {
        initialRouteLayer.route.properties.isVisible = false;
        spyOn(mapServiceMock.mapService.map, "addLayer");

        routesService.changeRouteState(initialRouteLayer);
        routesService.changeRouteState(initialRouteLayer);

        expect(routesService.selectedRoute).not.toBeNull();
        expect(mapServiceMock.mapService.map.addLayer).toHaveBeenCalled();
    });

    it("Should create index based names when they exists", () => {
        mapServiceMock.resourcesService.route = "route";
        routesService.addRoute(null);
        let routeName = routesService.createRouteName();
        initialRouteLayer.route.properties.name = routeName;
        routeName = routesService.createRouteName();
        expect(initialRouteLayer.route.properties.name).toBe(mapServiceMock.resourcesService.route + " 1");
        expect(routeName).toBe(mapServiceMock.resourcesService.route + " 2");
    });

    it("Should append index to route name", () => {
        let name = "name";

        let newName = routesService.createRouteName(name);

        expect(newName).toBe(name + " 1");
    });
    it("Should be able to get route by name", () => {
        let routeByName = routesService.getRouteByName(initialRouteLayer.route.properties.name);
        expect(routeByName).not.toBeNull();
    });

    it("Should split a route", () => {
        let latLng1 = L.latLng([0, 0]);
        let latLng2 = L.latLng([0.1, 0.1]);
        let segment1 = { latlngs: [latLng1, latLng1], routePoint: latLng1 } as IRouteSegment;
        let segment2 = { latlngs: [latLng1, latLng2], routePoint: latLng2 } as IRouteSegment;
        initialRouteLayer.setHiddenState = () => { };
        initialRouteLayer.raiseDataChanged = () => { };
        initialRouteLayer.getLastLatLng = () => latLng2;
        initialRouteLayer.route.segments = [];
        initialRouteLayer.route.segments.push(segment1);
        initialRouteLayer.route.segments.push(segment2);
        routesService.addRoute(null);

        routesService.splitSelectedRouteAt(segment1);

        expect(routesService.routes.length).toBe(2);
    });

    it("Should merge the selected route as the first route", () => {
        let latLng1 = L.latLng([0, 0]);
        let latLng2 = L.latLng([0.1, 0.1]);
        let segment1 = { latlngs: [latLng1, latLng1], routePoint: latLng1 } as IRouteSegment;
        let segment2 = { latlngs: [latLng1, latLng2], routePoint: latLng2 } as IRouteSegment;
        initialRouteLayer.setHiddenState = () => { };
        initialRouteLayer.raiseDataChanged = () => { };
        initialRouteLayer.getLastLatLng = () => latLng2;
        initialRouteLayer.route.segments = [];
        initialRouteLayer.route.segments.push(segment1);
        initialRouteLayer.route.segments.push(segment2);
        routesService.addRoute(null);

        let secondRoute = {
            route: {
                properties: {
                    name: "name2"
                },
                segments: [
                    { latlngs: [latLng2, latLng1], routePoint: latLng1 } as IRouteSegment
                ]
            },
            getLastLatLng: () => latLng1
        } as IRouteLayer;
        routesService.routes.push(secondRoute);
        routesService.mergeSelectedRouteToClosest(true);

        expect(routesService.routes.length).toBe(1);
    });
});