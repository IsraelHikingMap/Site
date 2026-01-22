import { Urls } from "../urls";
import type { CategoriesGroup, EditableLayer, Language, MutableApplicationState, Overlay, RouteData, StateWithHistory } from "../models";

export const HIKING_MAP = "Hiking Map";
export const MTB_MAP = "MTB Map";
export const HIKING_TRAILS = "Hiking Trails";
export const BICYCLE_TRAILS = "Bicycle Trails";
export const POPULARITY_HEATMAP = "Popularity Heatmap";
export const POINTS_OF_INTEREST = "Points of Interest";

export const AVAILABLE_LANGUAGES: Language[] = [{
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
    code: "he",
    rtl: true,
    label: "עברית"
},
{
    code: "ar",
    rtl: true,
    label: "العربية"
}];

export const CATEGORIES_GROUPS: CategoriesGroup[] = [{
    type: POINTS_OF_INTEREST,
    categories: [{
        color: "#1e80e3",
        icon: "icon-tint",
        name: "Water",
        selectableItems: [{
            color: "#1e80e3",
            icon: "icon-tint",
            label: "Spring, Pond"
        }, {
            color: "#1e80e3",
            icon: "icon-waterfall",
            label: "Waterfall"
        }, {
            color: "#1e80e3",
            icon: "icon-waterhole",
            label: "Waterhole"
        }, {
            color: "#1e80e3",
            icon: "icon-water-well",
            label: "Water Well"
        }, {
            color: "#1e80e3",
            icon: "icon-cistern",
            label: "Cistern"
        }]
    }, {
        color: "#666666",
        icon: "icon-ruins",
        name: "Historic",
        selectableItems: [{
            color: "#666666",
            icon: "icon-ruins",
            label: "Ruins"
        }, {
            color: "#666666",
            icon: "icon-archaeological",
            label: "Archaeological Site"
        }, {
            color: "#666666",
            icon: "icon-memorial",
            label: "Memorial"
        }]
    }, {
        color: "#008000",
        icon: "icon-viewpoint",
        name: "Viewpoint",
        selectableItems: [{
            color: "#008000",
            icon: "icon-viewpoint",
            label: "Viewpoint"
        }]
    }, {
        color: "#734a08",
        icon: "icon-picnic",
        name: "Camping",
        selectableItems: [{
            color: "#734a08",
            icon: "icon-picnic",
            label: "Picnic Area"
        }, {
            color: "#734a08",
            icon: "icon-campsite",
            label: "Campsite"
        }]
    }, {
        color: "#008000",
        icon: "icon-tree",
        name: "Natural",
        selectableItems: [{
            color: "black",
            icon: "icon-cave",
            label: "Cave"
        }, {
            color: "#008000",
            icon: "icon-tree",
            label: "Tree"
        }, {
            color: "#008000",
            icon: "icon-flowers",
            label: "Flowers"
        }]
    }, {
        color: "#ffb800",
        icon: "icon-star",
        name: "Other",
        selectableItems: [{
            color: "#ffb800",
            icon: "icon-star",
            label: "Attraction"
        }, {
            color: "#ffb800",
            icon: "icon-artwork",
            label: "Artwork"
        }]
    }],
}, {
    type: "Routes",
    categories: [{
        color: "black",
        icon: "icon-hike",
        name: "Hiking",
        selectableItems: []
    }, {
        color: "black",
        icon: "icon-bike",
        name: "Bicycle",
        selectableItems: []
    }, {
        color: "black",
        icon: "icon-four-by-four",
        name: "4x4",
        selectableItems: []
    }]
}];

export const DEFAULT_BASE_LAYERS: EditableLayer[] = [{
    key: HIKING_MAP,
    address: Urls.HIKING_TILES_ADDRESS,
    isEditable: false,
    minZoom: 1,
    maxZoom: 16,
    opacity: 1,
    id: null
}, {
    key: MTB_MAP,
    address: Urls.MTB_TILES_ADDRESS,
    isEditable: false,
    minZoom: 1,
    maxZoom: 16,
    opacity: 1,
    id: null
}];

export const DEFAULT_OVERLAYS: Overlay[] = [];

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
            version: 10,
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
            baseLayers: [],
            overlays: [],
            selectedBaseLayerKey: HIKING_MAP,
            expanded: ["Base Layers", "Private Routes"],
            visibleCategories: CATEGORIES_GROUPS.map(cg => cg.categories.map(c => ({ groupType: cg.type, name: c.name }))).flat()
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
            uploadPoiQueue: [],
            purchasesSynced: false
        }
    } as MutableApplicationState;
