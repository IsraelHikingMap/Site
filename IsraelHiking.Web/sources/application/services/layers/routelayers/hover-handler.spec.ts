import { HoverHandler } from "./hover-handler";
import { MapServiceMockCreator } from "../../map.service.spec";

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

        expect(mapServiceMockCreator.getNumberOfLayers()).toBe(0);
    });

    it("Should be show middle marker when on polyline", () => {
        hoverHandler.setState(HoverHandler.ON_POLYLINE);

        expect(mapServiceMockCreator.getNumberOfLayers()).toBe(1);
    });

    it("Should be show show line and marker when in add point state", () => {
        hoverHandler.setState(HoverHandler.ADD_POINT);

        expect(mapServiceMockCreator.getNumberOfLayers()).toBe(3); // including svg layer for marker icon
    });

    it("Should not change state when dragging", () => {
        hoverHandler.setState(HoverHandler.DRAGGING);

        hoverHandler.onMouseMove(null);
        
        expect(hoverHandler.getState()).toBe(HoverHandler.DRAGGING);
    });

    it("Should transition to add point state when using hover for point", () => {
        hoverHandler.setState(HoverHandler.NONE);
        hoverHandler.setRouteHover(false);
        
        hoverHandler.onMouseMove({ latlng: L.latLng([0,0]) } as L.MouseEvent);

        expect(hoverHandler.getState()).toBe(HoverHandler.ADD_POINT);
    });

    it("Should transition to on polyline state when using hover for route on route", () => {
        hoverHandler.setState(HoverHandler.NONE);
        hoverHandler.setRouteHover(true);
        context.snapToRoute = () => {
            return {
                polyline: L.polyline([]),
                latlng: L.latLng([0,0])
            };
        }
        
        hoverHandler.onMouseMove({ latlng: L.latLng([0, 0]) } as L.MouseEvent);

        expect(hoverHandler.getState()).toBe(HoverHandler.ON_POLYLINE);
    });

    it("Should transition to add point state when using hover for route not on route", () => {
        hoverHandler.setState(HoverHandler.NONE);
        hoverHandler.setRouteHover(true);
        context.snapToRoute = () => {
            return {
                polyline: null
            };
        };
        context.snappingService = {
            snapTo: () => {
                return {
                    latlng: L.latLng([0, 0])
                }
            }
        };
        context.route.segments = [];
        
        hoverHandler.onMouseMove({ latlng: L.latLng([0, 0]) } as L.MouseEvent);

        expect(hoverHandler.getState()).toBe(HoverHandler.ADD_POINT);
    });
});