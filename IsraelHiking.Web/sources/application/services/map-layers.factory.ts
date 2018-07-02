import { Injectable } from "@angular/core";
import * as L from "leaflet";
import * as esri from "esri-leaflet";
import "esri-leaflet-renderers";

import * as Common from "../common/IsraelHiking";

@Injectable()
export class MapLayersFactory {
    public static MIN_ZOOM = 7;
    public static MAX_NATIVE_ZOOM = 16;

    private static MAX_ZOOM = 20;

    public static createLayer(layerData: Common.LayerData, attribution?: string, zIndex?: number): L.Layer {
        if (layerData.address.toLowerCase().indexOf("{x}") !== -1) {
            let layer = L.tileLayer(layerData.address, MapLayersFactory.createOptionsFromLayerData(layerData, attribution));
            if (zIndex) {
                layer.setZIndex(zIndex);
            }
            return layer;
        } else if (layerData.address.toLowerCase().endsWith("/mapserver") ||
            layerData.address.toLowerCase().endsWith("/mapserver/")) {
            let options = MapLayersFactory.createEsriLayerOptions(layerData, attribution);
            return esri.dynamicMapLayer(options);
        } else {
            let options = MapLayersFactory.createEsriLayerOptions(layerData, attribution);
            let layer = esri.featureLayer(options);
            return layer;
        }
    }

    private static createOptionsFromLayerData = (layerData: Common.LayerData, attribution?: string): L.TileLayerOptions => {
        let maxNativeZoom = (layerData.maxZoom == null) ? MapLayersFactory.MAX_NATIVE_ZOOM : layerData.maxZoom;
        return {
            minZoom: (layerData.minZoom == null) ? MapLayersFactory.MIN_ZOOM : layerData.minZoom,
            maxNativeZoom: maxNativeZoom,
            maxZoom: Math.max(MapLayersFactory.MAX_ZOOM, maxNativeZoom),
            opacity: layerData.opacity || 1.0,
            attribution: attribution
        } as L.TileLayerOptions;
    }

    private static createEsriLayerOptions(layerData: Common.LayerData, attribution?: string) {
        let options = MapLayersFactory.createOptionsFromLayerData(layerData, attribution);
        options.url = layerData.address;
        options.style = () => {
            return { fillOpacity: options.opacity, opacity: options.opacity }
        };
        return options;
    }
}