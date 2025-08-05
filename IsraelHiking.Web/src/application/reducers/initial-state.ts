import { Urls } from "../urls";
import type { Language, MutableApplicationState, RouteData, StateWithHistory } from "../models/models";

export const HIKING_MAP = "Hiking Map";
export const MTB_MAP = "MTB Map";
export const HIKING_TRAILS = "Hiking Trails";
export const BICYCLE_TRAILS = "Bicycle Trails";
export const POPULARITY_HEATMAP = "Popularity Heatmap";

export const SPECIAL_BASELAYERS = [HIKING_MAP, MTB_MAP];
export const SPECIAL_OVERLAYS =  [HIKING_TRAILS, BICYCLE_TRAILS, POPULARITY_HEATMAP];
export const SPECIAL_LAYERS = [...SPECIAL_BASELAYERS, ...SPECIAL_OVERLAYS];

export const AVAILABLE_LANGUAGES: Language[] = [{
        code: "he",
        rtl: true,
        label: "עברית"
    },
    {
        code: "en-US",
        rtl: false,
        label: "English"
    },
    {
        code: "ru",
        rtl: false,
        label: "Русский"
    },
    {
        code: "ar",
        rtl: true,
        label: "العربية"
    }
];

export const initialState =
    {
        configuration: {
            batteryOptimizationType: "screen-on",
            isAutomaticRecordingUpload: true,
            isGotLostWarnings: false,
            isShowBatteryConfirmation: true,
            isShowIntro: true,
            isShowKmMarker: false,
            isShowSlope: false,
            version: "9.20",
            language: AVAILABLE_LANGUAGES.find(l => l.code === navigator.language) ?? AVAILABLE_LANGUAGES[0],
        },
        locationState: {
            longitude: 0,
            latitude: 0,
            zoom: 1
        },
        routes: {
            past: [],
            present: [],
            future: []
        } as StateWithHistory<RouteData[]>,
        routeEditingState: {
            routingType: "Hike",
            selectedRouteId: null,
            opacity: 0.4,
            weight: 9
        },
        recordedRouteState: {
            isAddingPoi: false,
            isRecording: false,
            route: null,
            pendingProcessing: []
        },
        tracesState: {
            visibleTraceId: null,
            traces: [],
            missingParts: null,
        },
        layersState: {
            baseLayers: [
                {
                    key: HIKING_MAP,
                    address: Urls.HIKING_TILES_ADDRESS,
                    isEditable: false,
                    isOfflineAvailable: true,
                    minZoom: 1,
                    maxZoom: 16
                },
                {
                    key: MTB_MAP,
                    address: Urls.MTB_TILES_ADDRESS,
                    isEditable: false,
                    isOfflineAvailable: true,
                    minZoom: 1,
                    maxZoom: 16
                }
            ],
            overlays: [],
            selectedBaseLayerKey: HIKING_MAP,
            expanded: ["Base Layers", "Private Routes"],
            categoriesGroups: [{
                type: "Points of Interest",
                categories: [],
                visible: true
            },
            {
                type: "Routes",
                categories: [],
                visible: true
            }]
        },
        shareUrlsState: {
            shareUrls: []
        },
        userState: {
            userInfo: null,
            token: null
        },
        poiState: {
            selectedPointOfInterest: null,
            uploadMarkerData: null
        },
        inMemoryState: {
            distance: false,
            following: true,
            pannedTimestamp: null,
            keepNorthUp: false,
            shareUrl: null,
            fileUrl: null,
            baseLayer: null
        },
        gpsState: {
            tracking: "disabled",
            currentPosition: null
        },
        offlineState: {
            isSubscribed: false,
            downloadedTiles: null,
            shareUrlsLastModifiedDate: null,
            uploadPoiQueue: []
        },
        uiComponentsState: {
            drawingVisible: false,
            statisticsVisible: false
        }
    } as MutableApplicationState;
