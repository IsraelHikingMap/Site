import * as L from "leaflet";

import { HoverHandlerPoi } from "./hover-handler-poi";
import { HoverHandlerRoute } from "./hover-handler-route";
import { HoverHandlerState } from "./hover-handler-base";
import { MapServiceMockCreator } from "../../map.service.spec";

describe("HoverHandler", () => {
    var context;
    var hoverHandlerPoi: HoverHandlerPoi;
    var hoverHandlerRoute: HoverHandlerRoute;
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
        hoverHandlerPoi = new HoverHandlerPoi(context);
        hoverHandlerRoute = new HoverHandlerRoute(context, middleMarker);
    });

    afterEach(() => {
        mapServiceMockCreator.destructor();
    });
    
    it("Should initialize with None state", () => {
        expect(hoverHandlerPoi.getState()).toBe(HoverHandlerState.NONE);
        expect(hoverHandlerRoute.getState()).toBe(HoverHandlerState.NONE);
    });

    it("Should be hidden when on marker", () => {
        hoverHandlerPoi.setState(HoverHandlerState.ON_MARKER);
        hoverHandlerRoute.setState(HoverHandlerState.ON_MARKER);

        expect(mapServiceMockCreator.getNumberOfLayers()).toBe(0);
    });

    it("Should show middle marker when on polyline", () => {
        hoverHandlerRoute.setState(HoverHandlerState.ON_POLYLINE);

        expect(mapServiceMockCreator.getNumberOfLayers()).toBe(1);
    });

    it("Should show line and marker when in add point state", () => {
        hoverHandlerRoute.setState(HoverHandlerState.ADD_POINT);

        expect(mapServiceMockCreator.getNumberOfLayers()).toBe(3); // including svg layer for marker icon
    });

    it("Should not change state when dragging", () => {
        hoverHandlerPoi.setState(HoverHandlerState.DRAGGING);
        hoverHandlerRoute.setState(HoverHandlerState.DRAGGING);

        hoverHandlerPoi.onMouseMove(null);
        hoverHandlerRoute.onMouseMove(null);
        
        expect(hoverHandlerPoi.getState()).toBe(HoverHandlerState.DRAGGING);
        expect(hoverHandlerRoute.getState()).toBe(HoverHandlerState.DRAGGING);
    });

    it("Should transition to add point state when using hover for point", () => {
        hoverHandlerPoi.setState(HoverHandlerState.NONE);
        context.snappingService = {
            snapToPoint: () => {
                return {
                    latlng: L.latLng([0, 0])
                }
            }
        };

        hoverHandlerPoi.onMouseMove({ latlng: L.latLng([0, 0]) } as L.LeafletMouseEvent);

        expect(hoverHandlerPoi.getState()).toBe(HoverHandlerState.ADD_POINT);
    });

    it("Should transition to on polyline state when using hover for route on route", () => {
        hoverHandlerRoute.setState(HoverHandlerState.NONE);
        context.snapToRoute = () => {
            return {
                polyline: L.polyline([]),
                latlng: L.latLng([0,0])
            };
        }
        
        hoverHandlerRoute.onMouseMove({ latlng: L.latLng([0, 0]) } as L.LeafletMouseEvent);

        expect(hoverHandlerRoute.getState()).toBe(HoverHandlerState.ON_POLYLINE);
    });

    it("Should transition to add point state when using hover for route not on route", () => {
        hoverHandlerRoute.setState(HoverHandlerState.NONE);
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
        
        hoverHandlerRoute.onMouseMove({ latlng: L.latLng([0, 0]) } as L.LeafletMouseEvent);

        expect(hoverHandlerRoute.getState()).toBe(HoverHandlerState.ADD_POINT);
    });
});