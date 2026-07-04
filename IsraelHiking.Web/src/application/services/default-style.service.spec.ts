import { describe, beforeEach, vi, it, expect, Mock } from "vitest";
import { inject, TestBed } from "@angular/core/testing";
import { NgxsModule, Store } from "@ngxs/store";
import type {
    BackgroundLayerSpecification,
    FillLayerSpecification,
    RasterDEMSourceSpecification,
    RasterLayerSpecification,
    RasterSourceSpecification,
    VectorSourceSpecification
} from "maplibre-gl";

import { DefaultStyleService } from "./default-style.service";
import { MapService } from "./map.service";
import { ResourcesService } from "./resources.service";
import { FileService } from "./file.service";
import { DEFAULT_BASE_LAYERS } from "../reducers/initial-state";
import type { EditableLayer } from "../models";

describe("DefaultStyleService", () => {
    const builtInLayerKey = DEFAULT_BASE_LAYERS[0].key;

    const createLayer = (data: Partial<EditableLayer>): EditableLayer => data as EditableLayer;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [NgxsModule.forRoot([])],
            providers: [
                DefaultStyleService,
                {
                    provide: MapService,
                    useValue: {
                        getFullUrl: (url: string) => `https://base/${url}`
                    }
                },
                {
                    provide: ResourcesService,
                    useValue: {
                        endOfBaseLayer: "endOfBaseLayer",
                        endOfOverlays: "endOfOverlays",
                        endOfClusters: "endOfClusters",
                        endOfRoutes: "endOfRoutes",
                        getCurrentLanguageCodeSimplified: () => "en"
                    }
                },
                {
                    provide: FileService,
                    useValue: {
                        getStyleJsonContent: vi.fn()
                    }
                }
            ]
        });

        TestBed.inject(Store).reset({
            offlineState: { downloadedTiles: null },
            configuration: { units: "metric" }
        });
    });

    it("should initialize the style with a sprite url from the map service", inject([DefaultStyleService], (service: DefaultStyleService) => {
        expect(service.style.version).toBe(8);
        expect(service.style.sources).toEqual({});
        expect(service.style.layers).toEqual([]);
        expect(service.style.sprite).toBe("https://base/content/sprite/sprite");
    }));

    it("should return a style with a dummy source and placeholder layers", inject([DefaultStyleService], (service: DefaultStyleService) => {
        const style = service.getStyleWithPlaceholders();

        expect(style.sources.dummy.type).toBe("geojson");
        expect(style.layers.map(l => l.id)).toEqual([
            "endOfBaseLayer",
            "endOfOverlays",
            "endOfClusters",
            "endOfRoutes"
        ]);
        for (const layer of style.layers) {
            expect(layer.layout?.visibility).toBe("none");
        }
    }));

    it("should not mutate the original style when building placeholders", inject([DefaultStyleService], (service: DefaultStyleService) => {
        service.getStyleWithPlaceholders();

        expect(service.style.sources).toEqual({});
        expect(service.style.layers).toEqual([]);
    }));

    it("should create a raster source and layer for a non-json address", inject([DefaultStyleService, FileService], async (service: DefaultStyleService, fileService: FileService) => {
        const result = await service.getSourcesAndLayers(createLayer({
            key: "raster-key",
            address: "https://tiles.example.com/{z}/{x}/{y}.png",
            minZoom: 5,
            maxZoom: 15,
            opacity: 0.5
        }), true, "online-only");

        const layer = result.layers[0] as RasterLayerSpecification;
        const source = result.sources[layer.source] as RasterSourceSpecification;

        expect(source.type).toBe("raster");
        expect(source.tiles).toEqual(["https://tiles.example.com/{z}/{x}/{y}.png"]);
        expect(source.scheme).toBe("xyz");
        expect(source.tileSize).toBe(256);
        expect(source.minzoom).toBe(4); // max(5 - 1, 0)
        expect(source.maxzoom).toBe(15);

        expect(layer.type).toBe("raster");
        expect(layer.layout?.visibility).toBe("visible");
        expect(layer.paint?.["raster-opacity"]).toBe(0.5);

        expect(fileService.getStyleJsonContent).not.toHaveBeenCalled();
    }));

    it("should set raster layer visibility to none when not visible", inject([DefaultStyleService], async (service: DefaultStyleService) => {
        const result = await service.getSourcesAndLayers(createLayer({
            key: "raster-key",
            address: "https://tiles.example.com/{z}/{x}/{y}.png",
            minZoom: 1,
            maxZoom: 10
        }), false, "online-only");

        const layer = result.layers[0] as RasterLayerSpecification;
        expect(layer.layout?.visibility).toBe("none");
    }));

    it("should append the export query for an ArcGIS MapServer address", inject([DefaultStyleService], async (service: DefaultStyleService) => {
        const result = await service.getSourcesAndLayers(createLayer({
            key: "raster-key",
            address: "https://server/arcgis/rest/MapServer",
            minZoom: 1,
            maxZoom: 10
        }), true, "online-only");

        const layer = result.layers[0] as RasterLayerSpecification;
        const source = result.sources[layer.source] as RasterSourceSpecification;
        expect(source.tiles?.[0]).toContain("https://server/arcgis/rest/MapServer/export?");
        expect(source.tiles?.[0]).toContain("format=png32");
        expect(source.tiles?.[0]).toContain("{bbox-epsg-3857}");
    }));

    it("should append the export query for a MapServer address that targets a specific layer index", inject([DefaultStyleService], async (service: DefaultStyleService) => {
        const result = await service.getSourcesAndLayers(createLayer({
            key: "raster-key",
            address: "https://server/arcgis/rest/MapServer/3",
            minZoom: 1,
            maxZoom: 10
        }), true, "online-only");

        const layer = result.layers[0] as RasterLayerSpecification;
        const source = result.sources[layer.source] as RasterSourceSpecification;
        expect(source.tiles?.[0]).toContain("https://server/arcgis/rest/MapServer/3/export?");
    }));

    it("should use the tms scheme and rewrite the y placeholder for a {-y} address", inject([DefaultStyleService], async (service: DefaultStyleService) => {
        const result = await service.getSourcesAndLayers(createLayer({
            key: "raster-key",
            address: "https://tiles.example.com/{z}/{x}/{-y}.png",
            minZoom: 1,
            maxZoom: 10
        }), true, "online-only");

        const layer = result.layers[0] as RasterLayerSpecification;
        const source = result.sources[layer.source] as RasterSourceSpecification;
        expect(source.tiles?.[0]).toBe("https://tiles.example.com/{z}/{x}/{y}.png");
        expect(source.scheme).toBe("tms");
    }));

    it("should generate unique ids for consecutive raster layers", inject([DefaultStyleService], async (service: DefaultStyleService) => {
        const first = await service.getSourcesAndLayers(createLayer({
            key: "raster-key",
            address: "https://tiles.example.com/a/{z}/{x}/{y}.png",
            minZoom: 1,
            maxZoom: 10
        }), true, "online-only");
        const second = await service.getSourcesAndLayers(createLayer({
            key: "raster-key",
            address: "https://tiles.example.com/b/{z}/{x}/{y}.png",
            minZoom: 1,
            maxZoom: 10
        }), true, "online-only");

        expect(first.layers[0].id).not.toBe(second.layers[0].id);
        expect(Object.keys(first.sources)[0]).not.toBe(Object.keys(second.sources)[0]);
    }));

    it("should replace the language and font but keep sources intact in online mode", inject([DefaultStyleService, FileService], async (service: DefaultStyleService, fileService: FileService) => {
        (fileService.getStyleJsonContent as Mock).mockResolvedValue(JSON.stringify({
            version: 8,
            glyphs: "https://fonts/{fontstack}/{range}.pbf",
            sources: {
                test: { type: "vector", url: "https://x/v.json", tiles: ["https://x/{z}/{x}/{y}.pbf"] }
            },
            layers: [
                {
                    id: "l",
                    type: "symbol",
                    source: "v",
                    "source-layer": "place",
                    layout: { "text-field": "{name:he}", "text-font": ["Open Sans Regular"] }
                }
            ]
        }));

        const result = await service.getSourcesAndLayers(createLayer({
            key: builtInLayerKey,
            address: "https://x/style.json"
        }), true, "online-only");

        const asText = JSON.stringify(result);
        expect(asText).toContain("name:en");
        expect(asText).not.toContain("name:he");
        expect(asText).toContain("Noto Sans");
        expect(asText).not.toContain("Open Sans");

        const source = result.sources.test as VectorSourceSpecification;
        expect(source.url).toBe("https://x/v.json");
        expect(source.tiles?.[0]).toBe("https://x/{z}/{x}/{y}.pbf");
    }));

    it("should not try getting the local style for a built-in base layer for online mode", inject([DefaultStyleService, FileService], async (service: DefaultStyleService, fileService: FileService) => {
        (fileService.getStyleJsonContent as Mock).mockResolvedValue(JSON.stringify({ version: 8, sources: {}, layers: [] }));

        await service.getSourcesAndLayers(createLayer({
            key: builtInLayerKey,
            address: "https://x/style.json"
        }), true, "online-only");

        expect(fileService.getStyleJsonContent).toHaveBeenCalledWith("https://x/style.json", false);
    }));

    it("should try getting the local style for a built-in base layer for offline mode", inject([DefaultStyleService, Store, FileService], async (service: DefaultStyleService, store: Store, fileService: FileService) => {
        store.reset({
            offlineState: { downloadedTiles: {} },
            configuration: { units: "metric" }
        });
        (fileService.getStyleJsonContent as Mock).mockResolvedValue(JSON.stringify({ version: 8, sources: {}, layers: [] }));

        await service.getSourcesAndLayers(createLayer({
            key: builtInLayerKey,
            address: "https://x/style.json"
        }), true, "allow-offline");

        expect(fileService.getStyleJsonContent).toHaveBeenCalledWith("https://x/style.json", true);
    }));

    it("should rewrite vector and raster-dem sources to the slice protocol when offline", inject([DefaultStyleService, FileService], async (service: DefaultStyleService, fileService: FileService) => {
        (fileService.getStyleJsonContent as Mock).mockResolvedValue(JSON.stringify({
            version: 8,
            sources: {
                test: { type: "vector", url: "https://x/v.json", tiles: ["https://x/{z}/{x}/{y}.pbf"] },
                dem: { type: "raster-dem", url: "https://x/dem.json", tiles: ["https://x/dem/{z}/{x}/{y}.png"] }
            },
            layers: []
        }));

        const result = await service.getSourcesAndLayers(createLayer({
            key: builtInLayerKey,
            address: "https://x/style.json"
        }), true, "allow-offline");

        const vector = result.sources.test as VectorSourceSpecification;
        const dem = result.sources.dem as RasterDEMSourceSpecification;
        expect(vector.url).toBeUndefined();
        expect(vector.tiles?.[0]).toBe("slice://x/{z}/{x}/{y}.pbf");
        expect(dem.url).toBeUndefined();
        expect(dem.tiles?.[0]).toBe("slice://x/dem/{z}/{x}/{y}.png");
    }));

    it("should append the slice query string to sources in car mode", inject([DefaultStyleService, FileService], async (service: DefaultStyleService, fileService: FileService) => {
        (fileService.getStyleJsonContent as Mock).mockResolvedValue(JSON.stringify({
            version: 8,
            sources: {
                test: { type: "vector", url: "https://x/v.json", tiles: ["https://x/{z}/{x}/{y}.pbf"] },
                dem: { type: "raster-dem", url: "https://x/dem.json", tiles: ["https://x/dem/{z}/{x}/{y}.png"] }
            },
            layers: []
        }));

        const result = await service.getSourcesAndLayers(createLayer({
            key: builtInLayerKey,
            address: "https://x/style.json"
        }), true, "car");

        const source = result.sources.test as VectorSourceSpecification;
        expect(source.url).toBeUndefined();
        expect(source.tiles?.[0]).toBe("https://x/{z}/{x}/{y}.pbf?use=slice");
        const dem = result.sources.dem as RasterDEMSourceSpecification;
        expect(dem.url).toBeUndefined();
        expect(dem.tiles?.[0]).toBe("https://x/dem/{z}/{x}/{y}.png?use=slice");
    }));

    it("should not manipulate sources for a layer that is not a built-in base layer", inject([DefaultStyleService, FileService], async (service: DefaultStyleService, fileService: FileService) => {
        (fileService.getStyleJsonContent as Mock).mockResolvedValue(JSON.stringify({
            version: 8,
            sources: {
                test: { type: "vector", url: "https://x/v.json", tiles: ["https://x/{z}/{x}/{y}.pbf"] }
            },
            layers: []
        }));

        const result = await service.getSourcesAndLayers(createLayer({
            key: "not-a-builtin-layer",
            address: "https://x/style.json"
        }), true, "allow-offline");

        const source = result.sources.test as VectorSourceSpecification;
        expect(source.url).toBe("https://x/v.json");
        expect(source.tiles?.[0]).toBe("https://x/{z}/{x}/{y}.pbf");
    }));

    it("should rewrite the contour source with a metric multiplier when offline", inject([DefaultStyleService, FileService], async (service: DefaultStyleService, fileService: FileService) => {
        (fileService.getStyleJsonContent as Mock).mockResolvedValue(JSON.stringify({
            version: 8,
            sources: {
                Contour: { type: "vector", url: "https://x/c.json", tiles: ["https://x/{z}/{x}/{y}.pbf"], maxzoom: 14 }
            },
            layers: []
        }));

        const result = await service.getSourcesAndLayers(createLayer({
            key: builtInLayerKey,
            address: "https://x/style.json"
        }), true, "allow-offline");

        const contour = result.sources.Contour as VectorSourceSpecification;
        expect(contour.url).toBeUndefined();
        expect(contour.tiles?.[0]).toContain("dem-contour://");
        expect(contour.tiles?.[0]).toContain("multiplier=1");
        expect(contour.maxzoom).toBe(16);
    }));

    it("should use the imperial multiplier for the contour source when units are imperial", inject([DefaultStyleService, Store, FileService], async (service: DefaultStyleService, store: Store, fileService: FileService) => {
        store.reset({
            offlineState: { downloadedTiles: null },
            configuration: { units: "imperial" }
        });
        (fileService.getStyleJsonContent as Mock).mockResolvedValue(JSON.stringify({
            version: 8,
            sources: {
                Contour: { type: "vector", url: "https://x/c.json", tiles: ["https://x/{z}/{x}/{y}.pbf"], maxzoom: 14 }
            },
            layers: []
        }));

        const result = await service.getSourcesAndLayers(createLayer({
            key: builtInLayerKey,
            address: "https://x/style.json"
        }), true, "allow-offline");

        const contour = result.sources.Contour as VectorSourceSpecification;
        expect(contour.tiles?.[0]).toContain("multiplier=3.28084");
    }));

    it("should tag the contour source with the slice and units query in car mode", inject([DefaultStyleService, FileService], async (service: DefaultStyleService, fileService: FileService) => {
        (fileService.getStyleJsonContent as Mock).mockResolvedValue(JSON.stringify({
            version: 8,
            sources: {
                Contour: { type: "vector", url: "https://x/c.json", tiles: ["https://x/{z}/{x}/{y}.pbf"], maxzoom: 14 }
            },
            layers: []
        }));

        const result = await service.getSourcesAndLayers(createLayer({
            key: builtInLayerKey,
            address: "https://x/style.json"
        }), true, "car");

        const contour = result.sources.Contour as VectorSourceSpecification;
        expect(contour.url).toBeUndefined();
        expect(contour.tiles?.[0]).not.toContain("dem-contour://");
        expect(contour.tiles?.[0]).toBe("https://x/{z}/{x}/{y}.pbf?use=slice&contour=metric");
        expect(contour.maxzoom).toBe(16);
    }));

    it("should tag the contour source with imperial units in car mode when configured", inject([DefaultStyleService, Store, FileService], async (service: DefaultStyleService, store: Store, fileService: FileService) => {
        store.reset({
            offlineState: { downloadedTiles: null },
            configuration: { units: "imperial" }
        });
        (fileService.getStyleJsonContent as Mock).mockResolvedValue(JSON.stringify({
            version: 8,
            sources: {
                Contour: { type: "vector", url: "https://x/c.json", tiles: ["https://x/{z}/{x}/{y}.pbf"], maxzoom: 14 }
            },
            layers: []
        }));

        const result = await service.getSourcesAndLayers(createLayer({
            key: builtInLayerKey,
            address: "https://x/style.json"
        }), true, "car");

        const contour = result.sources.Contour as VectorSourceSpecification;
        expect(contour.tiles?.[0]).toBe("https://x/{z}/{x}/{y}.pbf?use=slice&contour=imperial");
    }));

    it("should treat a .json address with a query string as a vector style", inject([DefaultStyleService, FileService], async (service: DefaultStyleService, fileService: FileService) => {
        (fileService.getStyleJsonContent as Mock).mockResolvedValue(JSON.stringify({ version: 8, sources: {}, layers: [] }));

        await service.getSourcesAndLayers(createLayer({
            key: builtInLayerKey,
            address: "https://x/style.json?cache=123"
        }), true, "online-only");

        expect(fileService.getStyleJsonContent).toHaveBeenCalled();
    }));

    it("should recolor the background and palette fills, leaving others untouched, when the theme is dark", inject([DefaultStyleService, Store, FileService], async (service: DefaultStyleService, store: Store, fileService: FileService) => {
        store.reset({ offlineState: { downloadedTiles: null }, configuration: { units: "metric", theme: "dark" } });
        (fileService.getStyleJsonContent as Mock).mockResolvedValue(JSON.stringify({
            version: 8,
            sources: {},
            layers: [
                { id: "bg", type: "background", paint: { "background-color": "#FFFFFF" } },
                { id: "water-area", type: "fill", paint: { "fill-color": "#AAD3DF" } },
                { id: "area-residential", type: "fill", paint: { "fill-color": "#E0DFDF" } },
                { id: "other-fill", type: "fill", paint: { "fill-color": "#123456" } },
                { id: "area-landcover-low", type: "fill", paint: { "fill-opacity": 0.5 } },
                { id: "land-residential", type: "fill", paint: { "fill-color": "rgb(224, 224, 224)" } },
                { id: "land_wood_solid", type: "fill", paint: { "fill-color": "rgb(200, 217, 174)" } },
                { id: "water", type: "fill", paint: { "fill-color": "rgb(148, 193, 225)" } },
                { id: "water_riverbed", type: "fill", paint: { "fill-color": "rgb(200, 217, 174)", "fill-pattern": "stones_pattern" } },
                { id: "land_wood_pattern", type: "symbol", layout: { "icon-image": "forest_pattern" } },
                { id: "land_orchard", type: "fill", paint: { "fill-pattern": "orchard_pattern" } }
            ]
        }));

        const result = await service.getSourcesAndLayers(createLayer({ key: builtInLayerKey, address: "https://x/style.json" }), true, "online-only");

        expect((result.layers[0] as BackgroundLayerSpecification).paint?.["background-color"]).toBe("#1B1B1B");
        expect((result.layers[1] as FillLayerSpecification).paint?.["fill-color"]).toBe("#14202E");
        expect((result.layers[2] as FillLayerSpecification).paint?.["fill-color"]).toBe("#2B2B2B");
        expect((result.layers[3] as FillLayerSpecification).paint?.["fill-color"]).toBe("#123456"); // not in palette
        expect((result.layers[4] as FillLayerSpecification).paint?.["fill-color"]).toBeUndefined(); // no fill-color to replace
        expect((result.layers[5] as FillLayerSpecification).paint?.["fill-color"]).toBe("#2B2B2B"); // bike urban
        expect((result.layers[6] as FillLayerSpecification).paint?.["fill-color"]).toBe("#1D2A1A"); // bike landcover
        expect((result.layers[7] as FillLayerSpecification).paint?.["fill-color"]).toBe("#14202E"); // bike water
        expect((result.layers[8] as FillLayerSpecification).paint?.["fill-color"]).toBe("#1D2A1A"); // recolored...
        expect((result.layers[8] as FillLayerSpecification).paint?.["fill-pattern"]).toBeUndefined(); // ...and pattern stripped
        expect(result.layers[9].layout?.visibility).toBe("none"); // decorative forest pattern hidden
        expect(result.layers[10].layout?.visibility).toBe("none"); // decorative orchard pattern hidden
    }));

    it("should not recolor any layer when the theme is not dark", inject([DefaultStyleService, FileService], async (service: DefaultStyleService, fileService: FileService) => {
        (fileService.getStyleJsonContent as Mock).mockResolvedValue(JSON.stringify({
            version: 8,
            sources: {},
            layers: [
                { id: "bg", type: "background", paint: { "background-color": "#FFFFFF" } },
                { id: "water-area", type: "fill", paint: { "fill-color": "#AAD3DF" } }
            ]
        }));

        const result = await service.getSourcesAndLayers(createLayer({ key: builtInLayerKey, address: "https://x/style.json" }), true, "online-only");

        expect((result.layers[0] as BackgroundLayerSpecification).paint?.["background-color"]).toBe("#FFFFFF");
        expect((result.layers[1] as FillLayerSpecification).paint?.["fill-color"]).toBe("#AAD3DF");
    }));

    it("should not recolor any layer in car mode even when the theme is dark", inject([DefaultStyleService, Store, FileService], async (service: DefaultStyleService, store: Store, fileService: FileService) => {
        store.reset({ offlineState: { downloadedTiles: null }, configuration: { units: "metric", theme: "dark" } });
        (fileService.getStyleJsonContent as Mock).mockResolvedValue(JSON.stringify({
            version: 8,
            sources: {},
            layers: [
                { id: "bg", type: "background", paint: { "background-color": "#FFFFFF" } },
                { id: "water-area", type: "fill", paint: { "fill-color": "#AAD3DF" } }
            ]
        }));

        const result = await service.getSourcesAndLayers(createLayer({ key: builtInLayerKey, address: "https://x/style.json" }), true, "car");

        expect((result.layers[0] as BackgroundLayerSpecification).paint?.["background-color"]).toBe("#FFFFFF");
        expect((result.layers[1] as FillLayerSpecification).paint?.["fill-color"]).toBe("#AAD3DF");
    }));
});