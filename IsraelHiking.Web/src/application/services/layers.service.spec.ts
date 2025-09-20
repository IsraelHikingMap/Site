import { provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";
import { inject, TestBed } from "@angular/core/testing";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { vi, expect, it, describe, beforeEach, Mock } from "vitest";
import { NgxsModule, Store } from "@ngxs/store";

import { Urls } from "../urls";
import { ResourcesService } from "./resources.service";
import { LoggingService } from "./logging.service";
import { LayersService } from "./layers.service";
import { SetUserInfoAction, UserInfoReducer } from "../reducers/user.reducer";
import { AddBaseLayerAction, AddOverlayAction, LayersReducer, RemoveBaseLayerAction, RemoveOverlayAction, SelectBaseLayerAction, ToggleOfflineAction, UpdateBaseLayerAction, UpdateOverlayAction } from "../reducers/layers.reducer";
import type { EditableLayer, LayerData, Overlay } from "../models";

describe("LayersService", () => {
    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [NgxsModule.forRoot([LayersReducer, UserInfoReducer])],
            providers: [
                LayersService,
                provideHttpClient(withInterceptorsFromDi()),                
                provideHttpClientTesting(),
                { provide: LoggingService, useValue: {
                    info: vi.fn(),
                    warning: vi.fn(),
                }},
                { provide: ResourcesService, useValue: { getCurrentLanguageCodeSimplified: vi.fn() } }
            ]
        });
    });

    it("should sync user layers when user logs off", inject([LayersService, Store, HttpTestingController], async (service: LayersService, store: Store, backend: HttpTestingController) => {
        vi.spyOn(store, "dispatch");

        store.reset({
            userState: {
                userInfo: null
            }
        })
        backend.expectNone(_ => true);
        expect(true).toBeTruthy();
    }));

    it("should sync user layers when user logs in with no data", inject([LayersService, Store, HttpTestingController], async (service: LayersService, store: Store, backend: HttpTestingController) => {
        vi.spyOn(store, "dispatch");

        store.reset({
            userState: {
                userInfo: {}
            }
        })
        
        backend.expectOne(u => u.url.startsWith(Urls.userLayers)).flush(null);

        expect(true).toBeTruthy();
    }));

    it("should sync user layers when user logs in with data that needs addintion, update and removal", inject([LayersService, Store, HttpTestingController], async (service: LayersService, store: Store, backend: HttpTestingController) => {
        const spy = vi.spyOn(store, "dispatch");

        store.reset({
            userState: {
                userInfo: null
            },
            layersState: {
                baseLayers: [
                    { key: "layer1", isEditable: true } as EditableLayer,
                    { key: "layer2", address: "https://layer2" } as EditableLayer
                ],
                overlays: [
                    { key: "overlay1", isEditable: true } as Overlay,
                    { key: "overlay2", address: "https://overlay2" } as Overlay
                ]
            }
        })
        
        store.dispatch(new SetUserInfoAction({ id: "1", displayName: "test", imageUrl: "https://test.com", changeSets: 0 }));

        backend.expectOne(u => u.url.startsWith(Urls.userLayers)).flush([
            {key: "layer2", address: "https://layer2-new", isOverlay: false},
            {key: "layer3", address: "https://layer3", isOverlay: false},
            {key: "overlay2", address: "https://overlay2-new", isOverlay: true},
            {key: "overlay3", address: "https://overlay3", isOverlay: true}
        ]);

        await new Promise(resolve => setTimeout(resolve, 10));
        expect(spy.mock.calls[0][0]).toBeInstanceOf(SetUserInfoAction);
        expect(spy.mock.calls[1][0]).toBeInstanceOf(UpdateBaseLayerAction);
        expect(spy.mock.calls[2][0]).toBeInstanceOf(AddBaseLayerAction);
        expect(spy.mock.calls[3][0]).toBeInstanceOf(UpdateOverlayAction);
        expect(spy.mock.calls[4][0]).toBeInstanceOf(AddOverlayAction);
        expect(spy.mock.calls[5][0]).toBeInstanceOf(RemoveOverlayAction);
        expect(spy.mock.calls[6][0]).toBeInstanceOf(RemoveBaseLayerAction);
    }));

    it("should check if base layer is selected", inject([LayersService, Store], (service: LayersService, store: Store) => {
        const layer: EditableLayer = { key: "layer1" } as EditableLayer;
        store.reset({ 
            layersState: { 
                selectedBaseLayerKey: layer.key 
            } 
        });
        expect(service.isBaseLayerSelected(layer)).toBeTruthy();
    }));

    it("should get selected base layer", inject([LayersService, Store], (service: LayersService, store: Store) => {
        const layer1: EditableLayer = { key: "layer1" } as EditableLayer;
        const layer2: EditableLayer = { key: "layer2" } as EditableLayer;
        store.reset({ 
            layersState: { 
                baseLayers: [layer1, layer2],
                selectedBaseLayerKey: layer2.key 
            } 
        });
        
        expect(service.getSelectedBaseLayer()).toEqual(layer2);
    }));

    it("should return first base layer when selected layer not found", inject([LayersService, Store], (service: LayersService, store: Store) => {
        const layer1: EditableLayer = { key: "layer1" } as EditableLayer;
        const layer2: EditableLayer = { key: "layer2" } as EditableLayer;
        store.reset({ 
            layersState: { 
                baseLayers: [layer1, layer2],
                selectedBaseLayerKey: "nonexistent" 
            } 
        });
        
        expect(service.getSelectedBaseLayer()).toEqual(layer1);
    }));

    it("should return the base layer address when it contains '{x}'", inject([LayersService, Store], (service: LayersService, store: Store) => {
        const baseLayer: EditableLayer = { 
            key: "layer", 
            address: "https://tiles.server/{z}/{x}/{y}.png" 
        } as EditableLayer;
        
        store.reset({ 
            layersState: { 
                baseLayers: [baseLayer],
                selectedBaseLayerKey: baseLayer.key
            } 
        });
        
        const address = service.getSelectedBaseLayerAddressForOSM();
        
        expect(address).toEqual(baseLayer.address);
    }));

    it("should return default Hebrew tiles when base layer has no address", inject([LayersService, Store, ResourcesService], 
        (service: LayersService, store: Store, resourcesService: ResourcesService) => {
        const baseLayer: EditableLayer = { 
            key: "layer", 
            address: "" 
        } as EditableLayer;
        
        store.reset({ 
            layersState: { 
                baseLayers: [baseLayer],
                selectedBaseLayerKey: baseLayer.key
            } 
        });
        
        (resourcesService.getCurrentLanguageCodeSimplified as Mock).mockReturnValue("he");
        
        const address = service.getSelectedBaseLayerAddressForOSM();
        
        expect(address).toEqual(`${Urls.baseTilesAddress}/Hebrew/Tiles/{z}/{x}/{y}.png`);
    }));

    it("should return English tiles when language is not Hebrew", inject([LayersService, Store, ResourcesService], 
        (service: LayersService, store: Store, resourcesService: ResourcesService) => {
        const baseLayer: EditableLayer = { 
            key: "layer", 
            address: "someAddress" 
        } as EditableLayer;
        
        store.reset({ 
            layersState: { 
                baseLayers: [baseLayer],
                selectedBaseLayerKey: baseLayer.key
            } 
        });
        
        (resourcesService.getCurrentLanguageCodeSimplified as Mock).mockReturnValue("en");
        
        const address = service.getSelectedBaseLayerAddressForOSM();
        
        expect(address).toEqual(`${Urls.baseTilesAddress}/English/Tiles/{z}/{x}/{y}.png`);
    }));

    it("should return MTB tiles for ilMTB style", inject([LayersService, Store, ResourcesService], 
        (service: LayersService, store: Store, resourcesService: ResourcesService) => {
        const baseLayer: EditableLayer = { 
            key: "layer", 
            address: "https://tiles.server/styles/ilMTB.json" 
        } as EditableLayer;
        
        store.reset({ 
            layersState: { 
                baseLayers: [baseLayer],
                selectedBaseLayerKey: baseLayer.key
            } 
        });
        
        (resourcesService.getCurrentLanguageCodeSimplified as Mock).mockReturnValue("he");
        
        const address = service.getSelectedBaseLayerAddressForOSM();
        
        expect(address).toEqual(`${Urls.baseTilesAddress}/Hebrew/mtbTiles/{z}/{x}/{y}.png`);
    }));

    it("should check if name is available", inject([LayersService, Store], (service: LayersService, store: Store) => {
        const layer1: EditableLayer = { key: "layer1" } as EditableLayer;
        const layer2: EditableLayer = { key: "layer2" } as EditableLayer;
        const overlay1: Overlay = { key: "overlay1", visible: true } as Overlay;
        store.reset({ 
            layersState: { 
                baseLayers: [layer1, layer2],
                overlays: [overlay1]
            } 
        });
        
        // Same name as existing key is available for that layer
        expect(service.isNameAvailable("layer1", "layer1", false)).toBeTruthy();
        // Different name that doesn't exist is available
        expect(service.isNameAvailable("layer1", "newLayer", false)).toBeTruthy();
        // Name that already exists is not available
        expect(service.isNameAvailable("layer1", "layer2", false)).toBeFalsy();
        // Empty name is not available
        expect(service.isNameAvailable("layer1", "", false)).toBeFalsy();
        // For overlays
        expect(service.isNameAvailable("overlay2", "overlay1", true)).toBeFalsy();
    }));

    it("should select base layer", inject([LayersService, Store], (service: LayersService, store: Store) => {
        const spy = vi.spyOn(store, "dispatch");
        
        service.selectBaseLayer("newLayer");
        
        expect(spy.mock.calls[0][0]).toBeInstanceOf(SelectBaseLayerAction);
    }));

    it("should toggle overlay", inject([LayersService, Store], (service: LayersService, store: Store) => {
        const spy = vi.spyOn(store, "dispatch");
        const overlay: Overlay = { key: "overlay1", visible: false } as Overlay;
        
        service.toggleOverlay(overlay);

        expect(spy.mock.calls[0][0]).toBeInstanceOf(UpdateOverlayAction);
    }));

    it("should check if all overlays are hidden", inject([LayersService, Store], (service: LayersService, store: Store) => {
        const overlay1: Overlay = { key: "overlay1", visible: false } as Overlay;
        const overlay2: Overlay = { key: "overlay2", visible: false } as Overlay;
        store.reset({ 
            layersState: { 
                overlays: [overlay1, overlay2]
            } 
        });
        
        expect(service.isAllOverlaysHidden()).toBeTruthy();
        service.toggleOverlay(overlay1);
        expect(service.isAllOverlaysHidden()).toBeFalsy();
    }));

    it("should hide all overlays", inject([LayersService, Store], (service: LayersService, store: Store) => {
        vi.spyOn(store, "dispatch");
        const overlay1: Overlay = { key: "overlay1", visible: true } as Overlay;
        const overlay2: Overlay = { key: "overlay2", visible: true } as Overlay;
        store.reset({ 
            layersState: { 
                overlays: [overlay1, overlay2]
            } 
        });
        
        service.hideAllOverlays();
        
        expect(service.isAllOverlaysHidden()).toBeTruthy();
    }));

    it("should ignore null or empty layer data", inject([LayersService, Store], (service: LayersService, store: Store) => {
        const spy = vi.spyOn(store, "dispatch");
        
        service.addExternalBaseLayer(null);
        service.addExternalBaseLayer({ address: "", key: "" } as LayerData);
        
        expect(spy).not.toHaveBeenCalled();
    }));

    it("should add external base layer with valid data", inject([LayersService, Store], (service: LayersService, store: Store) => {
        const spy = vi.spyOn(store, "dispatch");
        const layerData = { key: "newLayer", address: "https://tiles.server/{z}/{x}/{y}.png" } as LayerData;
        
        service.addExternalBaseLayer(layerData);

        expect(spy.mock.calls[0][0]).toBeInstanceOf(AddBaseLayerAction);
    }));
    
    it("should select existing base layer when address matches case insensitively", inject([LayersService, Store], (service: LayersService, store: Store) => {
        const spy = vi.spyOn(store, "dispatch");
        const baseLayer: EditableLayer = { 
            key: "existingLayer", 
            address: "https://existing.address/tiles" 
        } as EditableLayer;
        store.reset({ 
            layersState: { 
                baseLayers: [baseLayer]
            } 
        });
        
        service.addExternalBaseLayer({ 
            address: "https://EXISTING.address/tiles", 
            key: "newLayer" 
        } as LayerData);
        
        expect(spy.mock.calls[0][0]).toBeInstanceOf(SelectBaseLayerAction);
    }));
    
    it("should generate custom layer name when key is empty", inject([LayersService, Store], (service: LayersService, store: Store) => {
        const spy = vi.spyOn(store, "dispatch");
        
        service.addExternalBaseLayer({ 
            address: "https://new.address/tiles", 
            key: "" 
        } as LayerData);
        
        expect(spy.mock.calls[0][0]).toBeInstanceOf(AddBaseLayerAction);
    }));
    
    it("should increment custom layer index when custom layers exist", inject([LayersService, Store], (service: LayersService, store: Store) => {
        const spy = vi.spyOn(store, "dispatch");
        
        service.addExternalBaseLayer({ 
            address: "https://new.address/tiles", 
            key: "" 
        } as LayerData);
        service.addExternalBaseLayer({ 
            address: "https://new.address/tiles2", 
            key: "" 
        } as LayerData);

        expect(spy.mock.calls[0][0]).toBeInstanceOf(AddBaseLayerAction);
        expect(spy.mock.calls[1][0]).toBeInstanceOf(SelectBaseLayerAction);
        expect((spy.mock.calls[2][0] as AddBaseLayerAction).layerData.key).toContain("2");
    }));

    it("should do nothing if overlays array is null or empty", inject([LayersService, Store], (service: LayersService, store: Store) => {
        const spy = vi.spyOn(store, "dispatch");

        service.addExternalOverlays(null);
        service.addExternalOverlays([]);

        expect(spy).not.toHaveBeenCalled();
    }));

    it("should add external overlays and toggle visibility of hidden ones", inject([LayersService, Store], (service: LayersService, store: Store) => {
        const spy = vi.spyOn(store, "dispatch");
        const overlayData1 = { key: "overlay1", address: "https://test.com/1", visible: false } as Overlay;
        const overlayData2 = { key: "overlay2", address: "https://test.com/2" } as LayerData;
        const overlays = [overlayData1, overlayData2];

        store.reset({ 
            layersState: { 
                overlays: [overlayData1]
            } 
        });

        service.addExternalOverlays(overlays);

        expect(spy.mock.calls[0][0]).toBeInstanceOf(UpdateOverlayAction);
        expect(spy.mock.calls[1][0]).toBeInstanceOf(AddOverlayAction);
    }));

    it("should hide overlays that are not part of the share", inject([LayersService, Store], (service: LayersService, store: Store) => {
        const spy = vi.spyOn(store, "dispatch");
        const existingOverlay = { key: "existingOverlay", address: "https://existing.com", visible: true } as Overlay;
        const overlayData = { key: "newOverlay", address: "https://new.com" } as LayerData;
        const overlays = [overlayData] as LayerData[];

        store.reset({ 
            layersState: { 
                overlays: [existingOverlay]
            } 
        });

        service.addExternalOverlays(overlays);

        expect(spy.mock.calls[0][0]).toBeInstanceOf(AddOverlayAction);
        expect(spy.mock.calls[1][0]).toBeInstanceOf(UpdateOverlayAction);
    }));

    it("should get data container with selected layers", inject([LayersService, Store], (service: LayersService, store: Store) => {
        const baseLayer: EditableLayer = { key: "base" } as EditableLayer;
        const overlay1: Overlay = { key: "overlay1", visible: true } as Overlay;
        const overlay2: Overlay = { key: "overlay2", visible: false } as Overlay;
        store.reset({ 
            layersState: { 
                baseLayers: [baseLayer],
                overlays: [overlay1, overlay2],
                selectedBaseLayerKey: "base"
            } 
        });
        
        const data = service.getData();
        
        expect(data.baseLayer).toEqual(baseLayer);
        expect(data.overlays.length).toBe(1);
        expect(data.overlays[0]).toEqual(overlay1);
    }));

    it("should add base layer for non logged-in user", inject([LayersService, Store], (service: LayersService, store: Store) => {
        const spy = vi.spyOn(store, "dispatch");
        const layerData = { key: "newLayer", address: "https://test.com" } as LayerData;
        
        service.addBaseLayer(layerData);

        expect(spy.mock.calls[0][0]).toBeInstanceOf(AddBaseLayerAction);
    }))

    it("should add base layer for logged-in user", inject([LayersService, Store, HttpTestingController], async (service: LayersService, store: Store, backend: HttpTestingController) => {
        store.reset({
            userState: {
                userInfo: {}
            },
            layersState: {
                baseLayers: []
            }
        });
        backend.expectOne(u => u.method == "GET" && u.url.startsWith(Urls.userLayers)).flush(null);
        const spy = vi.spyOn(store, "dispatch");
        const layerData = { key: "newLayer", address: "https://test.com" } as LayerData;

        service.addBaseLayer(layerData);

        backend.expectOne(u => u.method == "POST" && u.url.startsWith(Urls.userLayers)).flush({ id: "1"});

        await new Promise(resolve => setTimeout(resolve, 10));

        expect(spy.mock.calls[0][0]).toBeInstanceOf(AddBaseLayerAction);
        expect(spy.mock.calls[1][0]).toBeInstanceOf(SelectBaseLayerAction);
        expect(spy.mock.calls[2][0]).toBeInstanceOf(UpdateBaseLayerAction);
    }));

    it("should not add base layer if it already exists", inject([LayersService, Store], (service: LayersService, store: Store) => {
        vi.spyOn(store, "dispatch");
        const existingLayer = { key: "existingLayer" } as EditableLayer;
        store.reset({ 
            layersState: { 
                baseLayers: [existingLayer]
            } 
        });
        
        service.addBaseLayer({ key: "existingLayer" } as LayerData);
        
        expect(store.dispatch).not.toHaveBeenCalled();
    }));

    it("should add overlay for non logged-in user", inject([LayersService, Store], (service: LayersService, store: Store) => {
        const spy = vi.spyOn(store, "dispatch");
        const overlayData = { key: "newOverlay", address: "https://test.com" } as LayerData;
        
        service.addOverlay(overlayData);

        expect(spy.mock.calls[0][0]).toBeInstanceOf(AddOverlayAction);
    }));

    it("should add overlay for non logged-in user", inject([LayersService, Store, HttpTestingController], async (service: LayersService, store: Store, backend: HttpTestingController) => {
        store.reset({
            userState: {
                userInfo: {}
            },
            layersState: {
                overlays: []
            }
        });
        backend.expectOne(u => u.method == "GET" && u.url.startsWith(Urls.userLayers)).flush(null);
        const spy = vi.spyOn(store, "dispatch");
        const overlayData = { key: "newOverlay", address: "https://test.com" } as LayerData;
        
        service.addOverlay(overlayData);

        backend.expectOne(u => u.method == "POST" && u.url.startsWith(Urls.userLayers)).flush({ id: "1"});

        await new Promise(resolve => setTimeout(resolve, 10));

        expect(spy.mock.calls[0][0]).toBeInstanceOf(AddOverlayAction);
        expect(spy.mock.calls[1][0]).toBeInstanceOf(UpdateOverlayAction);
    }));

    it("should not add overlay if it already exists", inject([LayersService, Store], (service: LayersService, store: Store) => {
        vi.spyOn(store, "dispatch");
        const existingOverlay = { key: "existingOverlay" } as Overlay;
        store.reset({ 
            layersState: { 
                overlays: [existingOverlay]
            } 
        });
        
        const result = service.addOverlay({ key: existingOverlay.key } as LayerData);
        
        expect(result).toEqual(existingOverlay);
        expect(store.dispatch).not.toHaveBeenCalled();
    }));

    it("should update base layer and select it", inject([LayersService, Store], (service: LayersService, store: Store) => {
        const spy = vi.spyOn(store, "dispatch");
        const layer = { key: "layer1", id: "1" } as EditableLayer;
        store.reset({ 
            layersState: { 
                baseLayers: [layer]
            } 
        });

        service.updateBaseLayer(layer, layer);

        expect(spy.mock.calls[0][0]).toBeInstanceOf(UpdateBaseLayerAction);
        expect(spy.mock.calls[1][0]).toBeInstanceOf(SelectBaseLayerAction);
    }));

    it("should update overlay when user is logged in", inject([LayersService, Store, HttpTestingController], (service: LayersService, store: Store, backend: HttpTestingController) => {
        store.reset({
            userState: {
                userInfo: {}
            },
            layersState: {
                overlays: []
            }
        })
        const spy = vi.spyOn(store, "dispatch");
        const layer = { key: "layer1", id: "1" } as Overlay;

        service.updateOverlay(layer, layer);

        backend.expectOne(u => u.method == "PUT" && u.url.startsWith(Urls.userLayers)).flush(null);
        expect(spy.mock.calls[0][0]).toBeInstanceOf(UpdateOverlayAction);
    }));

    it("should remove base layer and select first layer", inject([LayersService, Store], (service: LayersService, store: Store) => {
        const spy = vi.spyOn(store, "dispatch");
        const layer1 = { key: "layer1", id: "1" } as EditableLayer;
        const layer2 = { key: "layer2", id: "2" } as EditableLayer;
        store.reset({ 
            layersState: { 
                baseLayers: [layer1, layer2],
                selectedBaseLayerKey: layer2.key
            } 
        });
        
        service.removeBaseLayer(layer2);

        expect(spy.mock.calls[0][0]).toBeInstanceOf(SelectBaseLayerAction);
        expect(spy.mock.calls[1][0]).toBeInstanceOf(RemoveBaseLayerAction);
    }));

    it("should remove overlay for non registered user", inject([LayersService, Store], (service: LayersService, store: Store) => {
        const spy = vi.spyOn(store, "dispatch");
        const overlay = { key: "overlay1", id: "1" } as Overlay;
        
        service.removeOverlay(overlay);

        expect(spy.mock.calls[0][0]).toBeInstanceOf(RemoveOverlayAction);
    }));

    it("should toggle offline", inject([LayersService, Store], (service: LayersService, store: Store) => {
        const overlay = { key: "overlay1", id: "1", isOfflineOn: false } as Overlay;
        store.reset({ 
            layersState: { 
                overlays: [overlay]
            } 
        });
        const spy = vi.spyOn(store, "dispatch");
        
        service.toggleOffline(overlay, true);

        expect(spy.mock.calls[0][0]).toBeInstanceOf(ToggleOfflineAction);
    }));
});