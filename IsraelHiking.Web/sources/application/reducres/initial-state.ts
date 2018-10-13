import { ApplicationState, Location, Configuration, RouteData, RouteEditingState } from "../models/models";
import { StateWithHistory } from "redux-undo";

export const initialState =
    {
        configuration: {
            isAdvanced: false
        } as Configuration,
        location: {
            longitude: 35.12,
            latitude: 31.773,
            zoom: 13
        } as Location,
        routes: {
            past: [],
            present: [],
            future: []
        } as StateWithHistory<RouteData[]>,
        routeEditingState: {
            routingType: "Hike",
            selectedRouteId: null,
        } as RouteEditingState
    } as ApplicationState;