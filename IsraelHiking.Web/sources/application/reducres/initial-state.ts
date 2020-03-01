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
export const SATELLITE = "Satellite Imagery";
export const HIKING_TRAILS = "Hiking Trails";
export const BICYCLE_TRAILS = "Bicycle Trails";

export const initialState =
    {
        configuration: {
            isAdvanced: false,
            isBatteryOptimization: false,
            isAutomaticRecordingUpload: true,
            // isFindMissingRoutesAfterUpload: false,
            version: "9.0"
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
            recordingRouteId: null,
            opacity: 0.4,
            weight: 9
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
                    isOfflineAvailable: true,
                    isOfflineOn: false,
                    minZoom: 7,
                    maxZoom: 16
                },
                {
                    key: ISRAEL_MTB_MAP,
                    address: Urls.MTB_TILES_ADDRESS,
                    isEditable: false,
                    isOfflineAvailable: true,
                    isOfflineOn: false,
                    minZoom: 7,
                    maxZoom: 16
                },
                {
                    key: SATELLITE,
                    address: "https://tiles.arcgis.com/tiles/JcXY3lLZni6BK4El/arcgis/rest/services/תצלום_אוויר_2015/MapServer/tile/{z}/{y}/{x}",
                    isEditable: false,
                    isOfflineAvailable: false,
                    isOfflineOn: false,
                    minZoom: 7,
                    maxZoom: 17
                }
            ],
            overlays: [
                {
                    key: HIKING_TRAILS,
                    address: Urls.OVERLAY_TILES_ADDRESS,
                    minZoom: 7,
                    maxZoom: 16,
                    isOfflineAvailable: true,
                    isOfflineOn: false,
                    visible: false,
                    isEditable: false
                },
                {
                    key: BICYCLE_TRAILS,
                    address: Urls.OVERLAY_MTB_ADDRESS,
                    minZoom: 7,
                    maxZoom: 16,
                    isOfflineAvailable: true,
                    isOfflineOn: false,
                    visible: false,
                    isEditable: false
                }
            ],
            selectedBaseLayerKey: ISRAEL_HIKING_MAP,
            expanded: ["Base Layers", "Overlays", "Private Routes"],
            visible: []
        } as LayersState,
        userState: {
            userInfo: null,
            token: null
        },
        poiState: {
            selectedPointOfInterest: null,
            uploadMarkerData: null,
            isSidebarOpen: false
        },
        inMemoryState: {
            download: false,
            shareUrl: null,
            fileUrl: null,
            baseLayer: null
        }
    } as ApplicationState;
