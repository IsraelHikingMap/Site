import { StateWithHistory } from "redux-undo";

import {
    ApplicationState,
    Location,
    Configuration,
    RouteData,
    RouteEditingState,
    TracesState,
    LayersState
} from "../models/models";
import { Urls } from "../urls";

export const ISRAEL_HIKING_MAP = "Israel Hiking Map";
export const ISRAEL_MTB_MAP = "Israel MTB Map";
export const ESRI = "ESRI";
export const HIKING_TRAILS = "Hiking Trails";
export const BICYCLE_TRAILS = "Bicycle Trails";

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
        } as RouteEditingState,
        tracesState: {
            visibleTraceId: null,
            traces: [],
            missingParts: null,
        } as TracesState,
        layersState: {
            baseLayers: [
                {
                    key: ISRAEL_HIKING_MAP,
                    address: Urls.DEFAULT_TILES_ADDRESS,
                    isEditable: false,
                    minZoom: 7,
                    maxZoom: 16
                },
                {
                    key: ISRAEL_MTB_MAP,
                    address: Urls.MTB_TILES_ADDRESS,
                    isEditable: false,
                    minZoom: 7,
                    maxZoom: 16
                },
                {
                    key: ESRI,
                    address: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
                    isEditable: false,
                    minZoom: 0,
                    maxZoom: 16
                }
            ],
            overlays: [
                {
                    key: HIKING_TRAILS,
                    address: Urls.baseTilesAddress + Urls.OVERLAY_TILES_ADDRESS,
                    minZoom: 7,
                    maxZoom: 16,
                    visible: false,
                    isEditable: false
                },
                {
                    key: BICYCLE_TRAILS,
                    address: Urls.baseTilesAddress + Urls.OVERLAY_MTB_ADDRESS,
                    minZoom: 7,
                    maxZoom: 16,
                    visible: false,
                    isEditable: false
                }
            ],
            selectedBaseLayerKey: ISRAEL_HIKING_MAP
        } as LayersState,
        userState: {
            userInfo: null,
            token: null
        }
    } as ApplicationState;