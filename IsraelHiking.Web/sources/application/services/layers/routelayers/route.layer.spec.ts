import { Injector, ComponentFactoryResolver } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import * as L from "leaflet";

import { RouteLayer } from "./route.layer";
import { MapServiceMockCreator } from "../../map.service.spec";
import { IRoute, IRouteProperties, IRouteSegment, IMarkerWithData } from "./iroute.layer";
import { RouteData, MarkerData, RouteSegmentData } from "../../../common/IsraelHiking";
import { ResourcesService } from "../../resources.service";
import { GeoLocationService } from "../../geo-location.service";

describe("RouteLayer", () => {
    let routeLayer: RouteLayer;
    let snappingService;
    let routerService;
    let elevationProvider;
    let route: IRoute;
    let mapServiceMock: MapServiceMockCreator;

    beforeEach(() => {
        mapServiceMock = new MapServiceMockCreator();
        snappingService = {
            enable: () => { }
        };
        routerService = {};
        route = {
            segments: [],
            markers: [],
            properties: {
                pathOptions: {}
            }
        } as IRoute;
        let componentRefMock = {
            instance: {
                setMarker: () => { },
                setRouteLayer: () => { },
                angularBinding: () => { }
            }
        };
        let factory = {
            create: () => componentRefMock
        };
        let componentFactoryResolverMock = {
            resolveComponentFactory: () => factory
        };
        let geoLocationService = {} as GeoLocationService;
        TestBed.configureTestingModule({
            imports: [],
            providers: [
                Injector,
                { provide: ResourcesService, useValue: mapServiceMock.resourcesService },
                { provide: ComponentFactoryResolver, useValue: componentFactoryResolverMock }
            ],
        });

        routeLayer = new RouteLayer(mapServiceMock.mapService,
            snappingService,
            routerService,
            geoLocationService,
            elevationProvider,
            TestBed.get(Injector),
            TestBed.get(ComponentFactoryResolver),
            route);
    });

    afterEach(() => {
        mapServiceMock.destructor();
    });

    it("Should initialize with an empty route data", () => {
        expect(routeLayer.route.segments.length).toBe(0);
        expect(routeLayer.getEditMode()).toBe("None");
    });

    it("Can be added to the map", () => {
        mapServiceMock.mapService.map.addLayer(routeLayer);

        expect(mapServiceMock.getNumberOfLayers()).toBeGreaterThan(0);
    });

    it("Can be removed from the map", () => {
        mapServiceMock.mapService.map.addLayer(routeLayer);
        mapServiceMock.mapService.map.removeLayer(routeLayer);

        expect(mapServiceMock.getNumberOfLayers()).toBe(0);
    });

    it("Should update route properties when requested", () => {
        spyOn(routeLayer.dataChanged, "next");

        routeLayer.setRouteProperties({ pathOptions: { color: "red" } as L.PathOptions } as IRouteProperties);

        expect(routeLayer.route.properties.pathOptions.color).toBe("red");
        expect(routeLayer.dataChanged.next).toHaveBeenCalled();
    });

    it("Should use snapping service on route segments", () => {
        snappingService.snapToRoute = () => { };
        routeLayer.route.segments.push({ polyline: L.polyline([]) } as IRouteSegment);
        spyOn(snappingService, "snapToRoute");

        routeLayer.snapToSelf(L.latLng([0, 0]));

        expect(snappingService.snapToRoute).toHaveBeenCalled();
    });

    it("Should convert internal data to simple object", () => {
        routeLayer.route.properties.name = "name";
        routeLayer.route.segments.push({ latlngs: [], polyline: L.polyline([]) } as IRouteSegment);
        routeLayer.route.markers.push({ title: "title", latlng: L.latLng([0, 0]) } as IMarkerWithData);

        let data = routeLayer.getData();

        expect(data.markers.length).toBe(1);
        expect(data.segments.length).toBe(1);
        expect(data.name).toBe("name");
    });

    it("Should convert simple object to internal data", () => {
        let data = {
            name: "name",
            description: "description",
            markers: [{ latlng: L.latLng([0, 0]) } as MarkerData],
            segments: [{ latlngs: [L.latLng([0, 0]), L.latLng([0, 0])] } as RouteSegmentData],
            color: "blue, no yellow",
        } as RouteData;

        routeLayer.setData(data);

        expect(routeLayer.route.properties.name).toBe(undefined); // name should be set using setProperties method;
        expect(routeLayer.route.segments.length).toBe(1);
        expect(routeLayer.route.markers.length).toBe(1);
    });

    it("Should remove all markers and segments when cleared", () => {
        routeLayer.route.markers.push({} as IMarkerWithData);
        routeLayer.route.segments.push({} as IRouteSegment);

        routeLayer.clear();

        expect(routeLayer.route.segments.length).toBe(0);
        expect(routeLayer.route.markers.length).toBe(0);
    });

    it("Should raise event after undo", () => {
        let received = false;
        routeLayer.dataChanged.subscribe(() => {
            received = true;
        });

        routeLayer.undo();

        expect(received).toBeTruthy();
    });

    it("Should clear current state and initialize new state when changed", () => {
        routeLayer.setHiddenState();
        routeLayer.route.segments.push({ latlngs: [L.latLng([0, 0]), L.latLng([0, 0])], routePoint: L.latLng([0, 0]) } as IRouteSegment);
        routeLayer.setEditRouteState();
        routeLayer.setReadOnlyState();

        expect(mapServiceMock.getNumberOfLayers()).toBeGreaterThan(0);
    });
});