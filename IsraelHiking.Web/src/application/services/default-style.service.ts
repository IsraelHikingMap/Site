import { inject, Injectable } from "@angular/core";
import { Store } from "@ngxs/store";
import type { RasterLayerSpecification, RasterSourceSpecification, StyleSpecification } from "maplibre-gl";

import { MapService } from "./map.service";
import { ResourcesService } from "./resources.service";
import { FileService } from "./file.service";
import { DEFAULT_BASE_LAYERS } from "../reducers/initial-state";
import type { ApplicationState, EditableLayer, LayerData } from "../models";

@Injectable()
export class DefaultStyleService {
    private static indexNumber = 0;

    public style: StyleSpecification;

    private readonly mapService = inject(MapService);
    private readonly resources = inject(ResourcesService);
    private readonly store = inject(Store);
    private readonly fileService = inject(FileService);

    constructor() {
        this.style = {
            version: 8,
            sources: {},
            layers: [],
            sprite: this.mapService.getFullUrl("content/sprite/sprite")
        };
    }

    public getStyleWithPlaceholders(): StyleSpecification {
        const styleWithPlaceholder = { ...this.style };
        styleWithPlaceholder.sources = {
            dummy: {
                type: "geojson",
                data: {
                    type: "Feature",
                    properties: {},
                    geometry: {
                        type: "Point",
                        coordinates: [0, 0]
                    }
                }
            }
        };
        styleWithPlaceholder.layers = [
            {
                id: this.resources.endOfBaseLayer,
                type: "circle",
                source: "dummy",
                layout: { visibility: "none" }
            },
            {
                id: this.resources.endOfOverlays,
                type: "circle",
                source: "dummy",
                layout: { visibility: "none" }
            },
            {
                id: this.resources.endOfClusters,
                type: "circle",
                source: "dummy",
                layout: { visibility: "none" }
            },
            {
                id: this.resources.endOfRoutes,
                type: "circle",
                source: "dummy",
                layout: { visibility: "none" }
            }
        ];
        return styleWithPlaceholder;
    }

    private isRaster(address: string) {
        return address.match(/\.json(\?.+)?$/i) == null;
    }

    private createRasterLayer(layerData: LayerData, isVisible: boolean): StyleSpecification {
        const layerIndex = DefaultStyleService.indexNumber++;
        const rasterLayerId = `raster-layer-${layerIndex}`;
        const rasterSourceId = `raster-source-${layerIndex}`;
        let address = layerData.address;
        let scheme: "xyz" | "tms" = "xyz";
        if (layerData.address.match(/\/MapServer(\/\d+)?$/i) != null) {
            address += "/export?dpi=96&transparent=true&format=png32&bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=256,256&f=image";
        } else if (layerData.address.indexOf("{-y}") !== -1) {
            address = address.replace("{-y}", "{y}");
            scheme = "tms";
        }
        const source: RasterSourceSpecification = {
            type: "raster",
            tiles: [address],
            minzoom: Math.max(layerData.minZoom - 1, 0),
            maxzoom: layerData.maxZoom,
            scheme,
            tileSize: 256
        };
        const layer: RasterLayerSpecification = {
            id: rasterLayerId,
            type: "raster",
            source: rasterSourceId,
            layout: {
                visibility: (isVisible ? "visible" : "none") as "visible" | "none"
            },
            paint: {
                "raster-opacity": layerData.opacity || 1.0
            }
        };
        return {
            version: 8,
            sources: {
                [rasterSourceId]: source
            },
            layers: [layer]
        }
    }

    private manipulateStyle(styleAsText: string, language: string, units: "metric" | "imperial", manupulateSources: "sliceProtocol" | "sliceQuery" | "none", manupulateContour: boolean) {
        styleAsText = styleAsText.replace(/name:he/g, `name:${language}`);
        styleAsText = styleAsText.replaceAll("Open Sans", "Noto Sans");
        const styleJson = JSON.parse(styleAsText) as StyleSpecification;
        if (manupulateSources !== "none") {
            for (const source of Object.values(styleJson.sources)) {
                if (source.type === "vector") {
                    delete source.url;
                    if (manupulateSources === "sliceProtocol") {
                        source.tiles[0] = source.tiles[0].replace("https://", "slice://");
                    } else {
                        source.tiles[0] += "?use=slice";
                    }
                }
                if (source.type === "raster-dem") {
                    delete source.url;
                    if (manupulateSources === "sliceProtocol") {
                        source.tiles[0] = source.tiles[0].replace("https://", "slice://");
                    } else {
                        source.tiles[0] += "?use=slice";
                    }
                }
            }
        }
        if (manupulateContour && styleJson.sources["Contour"]?.type === "vector") {
            const contourSource = styleJson.sources["Contour"];
            const multiplier = units === "metric" ? 1 : 3.28084;
            delete contourSource.url;
            contourSource.tiles[0] = `dem-contour://{z}/{x}/{y}?contourLayer=contours&elevationKey=ele&levelKey=level&multiplier=${multiplier}&overzoom=1&thresholds=11*200*1000~12*10*100~13*10*100~14*10*100~15*10*100`
            contourSource.maxzoom = 16;
        }

        return styleJson;
    }

    public async getSourcesAndLayers(layerData: EditableLayer, isVisible: boolean, mode: "online" | "offline" | "car"): Promise<StyleSpecification> {
        if (this.isRaster(layerData.address)) {
            return this.createRasterLayer(layerData, isVisible);
        } else {
            const isBuiltInBaseLayer = DEFAULT_BASE_LAYERS.some(l => l.key === layerData.key);
            const tryLocalStyle = mode !== "online" && isBuiltInBaseLayer && this.store.selectSnapshot((s: ApplicationState) => s.offlineState).downloadedTiles != null;
            const language = this.resources.getCurrentLanguageCodeSimplified();
            const units = this.store.selectSnapshot((s: ApplicationState) => s.configuration.units);

            const styleAsText = await this.fileService.getStyleJsonContent(layerData.address, tryLocalStyle);
            const manupulateSources = mode === "online" || !isBuiltInBaseLayer ? "none" : mode === "car" ? "sliceQuery" : "sliceProtocol";
            const styleJson = this.manipulateStyle(styleAsText, language, units, manupulateSources, mode === "offline");
            return styleJson;
        }
    }
}
