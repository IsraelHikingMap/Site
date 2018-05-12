import { RouteStateEditPoi } from "./route-state-edit-poi";
import { MapServiceMockCreator } from "../../map.service.spec";

describe("RouteStateEditPoi", () => {
    let context;
    let routeStateEditPoi: RouteStateEditPoi;
    let mapServiceMockCreator: MapServiceMockCreator;

    beforeEach(() => {
        mapServiceMockCreator = new MapServiceMockCreator();
        context = {
            route: {
                properties: {
                    pathOptions: {
                        opacity: 1
                    }
                }
            },
            mapService: mapServiceMockCreator.mapService,
            snappingService: {
                enable: () => { }
            }
        };
    });

    afterEach(() => {
        mapServiceMockCreator.destructor();
    });

    it("Should initialize empty route", () => {
        context.route.segments = [];
        context.route.markers = [];

        routeStateEditPoi = new RouteStateEditPoi(context);

        expect(mapServiceMockCreator.getNumberOfLayers()).toBe(0);
    });
})