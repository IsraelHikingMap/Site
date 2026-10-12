import { describe, beforeEach, vi, it, expect, type Mock } from "vitest";
import { TestBed } from "@angular/core/testing";
import { provideStore, Store } from "@ngxs/store";
import { AsyncSubject, Subject } from "rxjs";
import { MapComponent, MapService } from "@maplibre/ngx-maplibre-gl";
import type { StyleSpecification } from "maplibre-gl";

import { AutomaticLayerPresentationComponent } from "./automatic-layer-presentation.component";
import { DefaultStyleService } from "../../services/default-style.service";
import { ResourcesService } from "../../services/resources.service";
import type { EditableLayer } from "../../models";

describe("AutomaticLayerPresentationComponent", () => {
    let mapLoad: Subject<void>;
    let mapLoaded: AsyncSubject<void>;
    let mapSources: Set<string>;
    let isMapLoaded: boolean;
    let getSourcesAndLayers: Mock;

    beforeEach(() => {
        mapLoad = new Subject<void>();
        mapLoaded = new AsyncSubject<void>();
        mapSources = new Set<string>();
        isMapLoaded = true;
        getSourcesAndLayers = vi.fn().mockName("DefaultStyleService.getSourcesAndLayers");
        TestBed.configureTestingModule({
            imports: [AutomaticLayerPresentationComponent],
            providers: [
                provideStore([]),
                {
                    provide: MapComponent,
                    useValue: {
                        mapLoad,
                        mapInstance: {
                            loaded: () => isMapLoaded,
                            addSource: (id: string) => {
                                if (mapSources.has(id)) {
                                    throw new Error(`Source "${id}" already exists.`);
                                }
                                mapSources.add(id);
                            },
                            removeSource: (id: string) => mapSources.delete(id),
                            addLayer: () => { },
                            removeLayer: () => { },
                            setMinZoom: () => { }
                        }
                    }
                },
                { provide: MapService, useValue: { mapLoaded$: mapLoaded } },
                { provide: DefaultStyleService, useValue: { getSourcesAndLayers } },
                { provide: ResourcesService, useValue: {} }
            ]
        });
        TestBed.inject(Store).reset({
            configuration: { language: { code: "en-US" }, units: "metric" },
            inMemoryState: { downloadedTiles: null, effectiveTheme: "light" }
        });
    });

    it("Should add an overlay created after the map has loaded while tiles are loading", async () => {
        getSourcesAndLayers.mockResolvedValue(createStyle());
        loadMap();
        isMapLoaded = false;

        createOverlay();

        await vi.waitFor(() => expect(mapSources.has("overlay_source")).toBeTruthy());
    });

    it("Should not add an overlay that was destroyed while its style was loading", async () => {
        let resolveStyle: (style: StyleSpecification) => void;
        getSourcesAndLayers.mockReturnValue(new Promise<StyleSpecification>(resolve => resolveStyle = resolve));
        loadMap();

        const fixture = createOverlay();
        await vi.waitFor(() => expect(getSourcesAndLayers).toHaveBeenCalled());
        fixture.destroy();
        resolveStyle(createStyle());
        await new Promise(resolve => setTimeout(resolve));

        expect(mapSources.size).toBe(0);
    });

    function loadMap() {
        mapLoad.next();
        mapLoaded.next();
        mapLoaded.complete();
    }

    function createOverlay() {
        const fixture = TestBed.createComponent(AutomaticLayerPresentationComponent);
        fixture.componentRef.setInput("layerData", { key: "overlay", address: "https://example.com/style.json" } as EditableLayer);
        fixture.componentRef.setInput("visible", true);
        fixture.componentRef.setInput("isBaselayer", false);
        fixture.detectChanges();
        return fixture;
    }

    function createStyle(): StyleSpecification {
        return {
            version: 8,
            sources: { source: { type: "raster", tiles: ["https://example.com/{z}/{x}/{y}.png"] } },
            layers: [{ id: "layer", type: "raster", source: "source" }]
        };
    }
});
