﻿import { Action } from "redux";
import { StateWithHistory } from "redux-undo";

import { Urls } from "../urls";
import type { ApplicationState, RouteData } from "../models/models";

export const ISRAEL_HIKING_MAP = "Israel Hiking Map";
export const ISRAEL_MTB_MAP = "Israel MTB Map";
export const ESRI = "ESRI";
export const SATELLITE = "Satellite Imagery";
export const HIKING_TRAILS = "Hiking Trails";
export const BICYCLE_TRAILS = "Bicycle Trails";

export abstract class BaseAction<TPayload> implements Action {
    constructor(public type: string, public payload: TPayload) { }
}

export const initialState =
    {
        configuration: {
            batteryOptimizationType: "screen-on",
            isAutomaticRecordingUpload: true,
            isGotLostWarnings: false,
            isShowBatteryConfirmation: true,
            isShowIntro: true,
            version: "9.14",
            language: {
                code: "he",
                rtl: true
            }
        },
        location: {
            longitude: 35.12,
            latitude: 31.773,
            zoom: 13
        },
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
        },
        tracesState: {
            visibleTraceId: null,
            traces: [],
            missingParts: null,
        },
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
                    address: "https://israelhiking.osm.org.il/Ortho/{z}/{y}/{x}.jpg",
                    isEditable: false,
                    isOfflineAvailable: false,
                    isOfflineOn: false,
                    minZoom: 7,
                    maxZoom: 16
                }
            ],
            overlays: [
                {
                    key: HIKING_TRAILS,
                    address: Urls.DEFAULT_TILES_ADDRESS,
                    minZoom: 7,
                    maxZoom: 16,
                    isOfflineAvailable: true,
                    isOfflineOn: false,
                    visible: false,
                    isEditable: false
                },
                {
                    key: BICYCLE_TRAILS,
                    address: Urls.MTB_TILES_ADDRESS,
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
            uploadMarkerData: null,
            isSidebarOpen: false
        },
        inMemoryState: {
            distance: false,
            pannedTimestamp: null,
            shareUrl: null,
            fileUrl: null,
            baseLayer: null
        },
        gpsState: {
            tracking: "disabled",
            currentPoistion: null
        },
        offlineState: {
            isOfflineAvailable: false,
            lastModifiedDate: null,
            poisLastModifiedDate: null,
            shareUrlsLastModifiedDate: null,
            uploadPoiQueue: []
        },
        uiComponentsState: {
            drawingVisible: false,
            searchVisible: false,
            statisticsVisible: false
        }
    } as ApplicationState;
