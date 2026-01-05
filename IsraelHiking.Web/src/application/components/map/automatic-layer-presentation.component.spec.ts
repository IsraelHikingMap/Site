import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NgxsModule, Store } from "@ngxs/store";
import { MapComponent } from "@maplibre/ngx-maplibre-gl";
import { Map, StyleSpecification } from "maplibre-gl";
import { Subject } from "rxjs";

import { AutomaticLayerPresentationComponent } from "./automatic-layer-presentation.component";
import { FileService } from "../../services/file.service";
import { MapService } from "../../services/map.service";
import { ResourcesService } from "../../services/resources.service";
import { OfflineReducer } from "../../reducers/offline.reducer";
import { ConfigurationReducer } from "../../reducers/configuration.reducer";
import { HIKING_MAP, AVAILABLE_LANGUAGES } from "../../reducers/initial-state";
import type { EditableLayer } from "../../models";

describe("AutomaticLayerPresentationComponent", () => {
    let fixture: ComponentFixture<AutomaticLayerPresentationComponent>;
    let fileService: jasmine.SpyObj<FileService>;
    let mapService: MapService;
    let store: Store;
    let mapInstance: jasmine.SpyObj<Map>;
    let mapLoadSubject: Subject<void>;

    beforeEach(async () => {
        mapLoadSubject = new Subject<void>();
        mapInstance = jasmine.createSpyObj<Map>("Map", ["addSource", "addLayer", "removeLayer", "removeSource", "setMinZoom"]);
        
        const mapComponentMock = {
            mapInstance: mapInstance,
            mapLoad: mapLoadSubject.asObservable()
        } as any as MapComponent;

        fileService = jasmine.createSpyObj<FileService>("FileService", ["getStyleJsonContent"]);
        const resourcesService = jasmine.createSpyObj<ResourcesService>("ResourcesService", ["getCurrentLanguageCodeSimplified"]);
        (resourcesService.getCurrentLanguageCodeSimplified as jasmine.Spy).and.returnValue("en");

        mapService = {
            initializationPromise: Promise.resolve()
        } as MapService;

        await TestBed.configureTestingModule({
            imports: [
                AutomaticLayerPresentationComponent,
                NgxsModule.forRoot([OfflineReducer, ConfigurationReducer])
            ],
            providers: [
                { provide: FileService, useValue: fileService },
                { provide: ResourcesService, useValue: resourcesService },
                { provide: MapService, useValue: mapService },
                { provide: MapComponent, useValue: mapComponentMock }
            ]
        }).compileComponents();

        store = TestBed.inject(Store);
        fixture = TestBed.createComponent(AutomaticLayerPresentationComponent);
    });

    afterEach(() => {
        fixture.destroy();
    });

    describe("useOfflineTiles functionality", () => {
        const hikingLayer: EditableLayer = {
            key: HIKING_MAP,
            address: "https://example.com/style.json",
            isEditable: false,
            minZoom: 1,
            maxZoom: 16,
            opacity: 1,
            id: null
        };

        const mockStyleJson: StyleSpecification = {
            version: 8,
            sources: {
                "source1": {
                    type: "vector",
                    tiles: ["https://example.com/tiles/{z}/{x}/{y}.mvt"],
                    url: "https://example.com/source.json"
                } as any,
                "source2": {
                    type: "raster-dem",
                    tiles: ["https://example.com/dem/{z}/{x}/{y}.png"],
                    url: "https://example.com/dem.json"
                } as any
            },
            layers: [
                { id: "layer1", type: "fill", source: "source1" } as any
            ],
            glyphs: ""
        };

        beforeEach(() => {
            fixture.componentRef.setInput("layerData", hikingLayer);
            fixture.componentRef.setInput("visible", true);
            fixture.componentRef.setInput("isBaselayer", true);
            fixture.componentRef.setInput("before", "endOfBaseLayer");
            mapLoadSubject.next();
        });

        it("should use slice:// protocol when useOfflineTiles is true and downloaded tiles exist", async () => {
            // Arrange
            fixture.componentRef.setInput("isMainMap", false);
            fixture.componentRef.setInput("useOfflineTiles", true);
            
            store.reset({
                offlineState: {
                    downloadedTiles: { "0-0": new Date() },
                    isSubscribed: true,
                    shareUrlsLastModifiedDate: new Date(),
                    uploadPoiQueue: []
                },
                configuration: {
                    batteryOptimizationType: "screen-on",
                    isAutomaticRecordingUpload: true,
                    isGotLostWarnings: false,
                    isShowBatteryConfirmation: true,
                    isShowIntro: true,
                    isShowKmMarker: false,
                    isShowSlope: false,
                    version: 10,
                    language: AVAILABLE_LANGUAGES[0]
                }
            });

            fileService.getStyleJsonContent.and.returnValue(Promise.resolve(mockStyleJson));

            // Act
            fixture.detectChanges();
            await new Promise(resolve => setTimeout(resolve, 100)); // Wait for async operations

            // Assert
            expect(fileService.getStyleJsonContent).toHaveBeenCalledWith(hikingLayer.address, true);
            
            // Verify that the style JSON was modified to use slice://
            const callArgs = fileService.getStyleJsonContent.calls.mostRecent().args;
            expect(callArgs[1]).toBe(true); // tryLocalStyle should be true
        });

        it("should NOT use slice:// protocol when useOfflineTiles is false", async () => {
            // Arrange
            fixture.componentRef.setInput("isMainMap", false);
            fixture.componentRef.setInput("useOfflineTiles", false);
            
            store.reset({
                offlineState: {
                    downloadedTiles: { "0-0": new Date() },
                    isSubscribed: true,
                    shareUrlsLastModifiedDate: new Date(),
                    uploadPoiQueue: []
                },
                configuration: {
                    batteryOptimizationType: "screen-on",
                    isAutomaticRecordingUpload: true,
                    isGotLostWarnings: false,
                    isShowBatteryConfirmation: true,
                    isShowIntro: true,
                    isShowKmMarker: false,
                    isShowSlope: false,
                    version: 10,
                    language: AVAILABLE_LANGUAGES[0]
                }
            });

            fileService.getStyleJsonContent.and.returnValue(Promise.resolve(mockStyleJson));

            // Act
            fixture.detectChanges();
            await new Promise(resolve => setTimeout(resolve, 100));

            // Assert
            expect(fileService.getStyleJsonContent).toHaveBeenCalledWith(hikingLayer.address, false);
        });

        it("should NOT use slice:// protocol when downloaded tiles do not exist", async () => {
            // Arrange
            fixture.componentRef.setInput("isMainMap", false);
            fixture.componentRef.setInput("useOfflineTiles", true);
            
            store.reset({
                offlineState: {
                    downloadedTiles: null,
                    isSubscribed: true,
                    shareUrlsLastModifiedDate: new Date(),
                    uploadPoiQueue: []
                },
                configuration: {
                    batteryOptimizationType: "screen-on",
                    isAutomaticRecordingUpload: true,
                    isGotLostWarnings: false,
                    isShowBatteryConfirmation: true,
                    isShowIntro: true,
                    isShowKmMarker: false,
                    isShowSlope: false,
                    version: 10,
                    language: AVAILABLE_LANGUAGES[0]
                }
            });

            fileService.getStyleJsonContent.and.returnValue(Promise.resolve(mockStyleJson));

            // Act
            fixture.detectChanges();
            await new Promise(resolve => setTimeout(resolve, 100));

            // Assert
            expect(fileService.getStyleJsonContent).toHaveBeenCalledWith(hikingLayer.address, false);
        });

        it("should use slice:// protocol when isMainMap is true (existing behavior)", async () => {
            // Arrange
            fixture.componentRef.setInput("isMainMap", true);
            fixture.componentRef.setInput("useOfflineTiles", false);
            
            store.reset({
                offlineState: {
                    downloadedTiles: { "0-0": new Date() },
                    isSubscribed: true,
                    shareUrlsLastModifiedDate: new Date(),
                    uploadPoiQueue: []
                },
                configuration: {
                    batteryOptimizationType: "screen-on",
                    isAutomaticRecordingUpload: true,
                    isGotLostWarnings: false,
                    isShowBatteryConfirmation: true,
                    isShowIntro: true,
                    isShowKmMarker: false,
                    isShowSlope: false,
                    version: 10,
                    language: AVAILABLE_LANGUAGES[0]
                }
            });

            fileService.getStyleJsonContent.and.returnValue(Promise.resolve(mockStyleJson));

            // Act
            fixture.detectChanges();
            await new Promise(resolve => setTimeout(resolve, 100));

            // Assert
            expect(fileService.getStyleJsonContent).toHaveBeenCalledWith(hikingLayer.address, true);
        });

        it("should use slice:// protocol when either isMainMap OR useOfflineTiles is true", async () => {
            // Arrange
            fixture.componentRef.setInput("isMainMap", true);
            fixture.componentRef.setInput("useOfflineTiles", true);
            
            store.reset({
                offlineState: {
                    downloadedTiles: { "0-0": new Date() },
                    isSubscribed: true,
                    shareUrlsLastModifiedDate: new Date(),
                    uploadPoiQueue: []
                },
                configuration: {
                    batteryOptimizationType: "screen-on",
                    isAutomaticRecordingUpload: true,
                    isGotLostWarnings: false,
                    isShowBatteryConfirmation: true,
                    isShowIntro: true,
                    isShowKmMarker: false,
                    isShowSlope: false,
                    version: 10,
                    language: AVAILABLE_LANGUAGES[0]
                }
            });

            fileService.getStyleJsonContent.and.returnValue(Promise.resolve(mockStyleJson));

            // Act
            fixture.detectChanges();
            await new Promise(resolve => setTimeout(resolve, 100));

            // Assert
            expect(fileService.getStyleJsonContent).toHaveBeenCalledWith(hikingLayer.address, true);
        });

        it("should NOT use slice:// protocol for non-default base layers even with useOfflineTiles", async () => {
            // Arrange
            const customLayer: EditableLayer = {
                key: "custom-layer",
                address: "https://example.com/custom.json",
                isEditable: true,
                minZoom: 1,
                maxZoom: 16,
                opacity: 1,
                id: null
            };

            fixture.componentRef.setInput("layerData", customLayer);
            fixture.componentRef.setInput("isMainMap", false);
            fixture.componentRef.setInput("useOfflineTiles", true);
            
            store.reset({
                offlineState: {
                    downloadedTiles: { "0-0": new Date() },
                    isSubscribed: true,
                    shareUrlsLastModifiedDate: new Date(),
                    uploadPoiQueue: []
                },
                configuration: {
                    batteryOptimizationType: "screen-on",
                    isAutomaticRecordingUpload: true,
                    isGotLostWarnings: false,
                    isShowBatteryConfirmation: true,
                    isShowIntro: true,
                    isShowKmMarker: false,
                    isShowSlope: false,
                    version: 10,
                    language: AVAILABLE_LANGUAGES[0]
                }
            });

            fileService.getStyleJsonContent.and.returnValue(Promise.resolve(mockStyleJson));

            // Act
            fixture.detectChanges();
            await new Promise(resolve => setTimeout(resolve, 100));

            // Assert
            expect(fileService.getStyleJsonContent).toHaveBeenCalledWith(customLayer.address, false);
        });
    });
});

