import { inject, TestBed } from "@angular/core/testing";
import { NgxsModule, Store } from "@ngxs/store";

import { RoutesReducer } from "../reducers/routes.reducer";
import { DataContainerService } from "./data-container.service";
import { ShareUrlsService } from "./share-urls.service";
import { LayersService } from "./layers.service";
import { FileService } from "./file.service";
import { ResourcesService } from "./resources.service";
import { ToastService } from "./toast.service";
import { SelectedRouteService } from "./selected-route.service";
import { RoutesFactory } from "./routes.factory";
import { MapService } from "./map.service";
import { RunningContextService } from "./running-context.service";
import type { RouteData, ShareUrl } from "../models";

describe("DataContainerService", () => {
    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [NgxsModule.forRoot([RoutesReducer])],
            providers: [
                DataContainerService,
                RoutesFactory,
                {
                    provide: ShareUrlsService, useValue: {
                        getSelectedShareUrl: () => { },
                        setShareUrlById: () => { },
                        setShareUrl: () => { }
                    }
                },
                {
                    provide: LayersService, useValue: {
                        addExternalOverlays: jasmine.createSpy(),
                        addExternalBaseLayer: jasmine.createSpy(),
                        getData: () => ({}),
                        selectBaseLayer: () => { }
                    }
                },
                {
                    provide: FileService, useValue: {
                        openFromUrl: () => { }
                    }
                },
                { provide: ResourcesService, useValue: {} },
                {
                    provide: ToastService, useValue: {
                        info: () => { },
                        error: () => { },
                        warning: () => { }
                    }
                },
                {
                    provide: SelectedRouteService, useValue: {
                        getSelectedRoute: () => null as any
                    }
                },
                {
                    provide: MapService, useValue: {
                        getMapBounds: () => ({ getNorthEast: () => ({ lat: 1, lng: 2 }), getSouthWest: () => ({ lat: 3, lng: 4 }) }),
                        fitBounds: jasmine.createSpy()
                    }
                },
                { provide: RunningContextService, useValue: {} }
            ]
        });
    });

    it("should get data", inject([DataContainerService], (service: DataContainerService) => {
        const routes: RouteData[] = [{
            state: "Hidden",
            id: "1",
            name: "name",
            description: "description",
            markers: [],
            segments: [{
                latlngs: [],
                routePoint: { lat: 1, lng: 2 },
                routingType: "Hike"
            }]
        }, {
            state: "Poi",
            id: "2",
            name: "name2",
            description: "description2",
            markers: [{} as any],
            segments: []
        }];
        const dataContainer = service.getContainerForRoutes(routes);
        expect(dataContainer.routes.length).toBe(2);
    }));

    it("should return if the share URL is already selected", inject([DataContainerService, ShareUrlsService], async (service: DataContainerService, shareUrlsService: ShareUrlsService) => {
        spyOn(shareUrlsService, "getSelectedShareUrl").and.returnValue({ id: "123" } as any);
        spyOn(shareUrlsService, "setShareUrlById");

        await service.setShareUrlAfterNavigation("123");

        expect(shareUrlsService.setShareUrlById).not.toHaveBeenCalled();
    }));

    it("should set share URL and show toast message if not in iframe", inject([DataContainerService, ShareUrlsService, ToastService, RunningContextService, MapService], async (service: DataContainerService, shareUrlsService: ShareUrlsService, toastService: ToastService, runningContextService: RunningContextService, mapService: MapService) => {
        const shareUrl = {
            id: "123", dataContainer: {
                routes: [],
                northEast: { lat: 1, lng: 2 },
                southWest: { lat: 3, lng: 4 }
            }, description: "desc", title: "title"
        } as ShareUrl;
        spyOn(shareUrlsService, "getSelectedShareUrl").and.returnValue(null);
        spyOn(shareUrlsService, "setShareUrlById").and.returnValue(Promise.resolve(shareUrl));
        spyOn(toastService, "info");
        (runningContextService as any).isIFrame = false;
        await service.setShareUrlAfterNavigation("42");

        expect(shareUrlsService.setShareUrlById).toHaveBeenCalledWith("42");
        expect(toastService.info).toHaveBeenCalledWith("desc", "title");
        expect(mapService.fitBounds).toHaveBeenCalled();
    }));

    it("should set file url after navigation", inject([DataContainerService, FileService, ToastService, Store], async (service: DataContainerService, fileService: FileService, toastService: ToastService, store: Store) => {
        spyOn(fileService, "openFromUrl").and.returnValue(Promise.resolve({} as any));
        spyOn(toastService, "warning");
        store.reset({
            inMemoryState: {}
        });
        await service.setFileUrlAfterNavigation("url", "baseLayer");

        expect(toastService.warning).toHaveBeenCalled();
    }));

    it("should not set file url after navigation if file url is already set", inject([DataContainerService, FileService, Store], async (service: DataContainerService, fileService: FileService, store: Store) => {
        spyOn(fileService, "openFromUrl");
        store.reset({
            inMemoryState: {
                fileUrl: "url"
            }
        });
        await service.setFileUrlAfterNavigation("url", "baseLayer");

        expect(fileService.openFromUrl).not.toHaveBeenCalled();
    }));

    it("should set share URL and not show toast message if in iframe and select base layer", inject([DataContainerService, ShareUrlsService, ToastService, RunningContextService, LayersService], async (service: DataContainerService, shareUrlsService: ShareUrlsService, toastService: ToastService, runningContextService: RunningContextService, layerService: LayersService) => {
        (runningContextService as any).isIFrame = true;
        const shareUrl = { id: "123", dataContainer: { baseLayer: "baseLayer", routes: [] }, description: "desc", title: "title" } as ShareUrl;
        spyOn(shareUrlsService, "getSelectedShareUrl").and.returnValue(null);
        spyOn(shareUrlsService, "setShareUrlById").and.returnValue(Promise.resolve(shareUrl));
        spyOn(toastService, "info");
        spyOn(layerService, "selectBaseLayer");

        await service.setShareUrlAfterNavigation("123");

        expect(shareUrlsService.setShareUrlById).toHaveBeenCalledWith("123");
        expect(toastService.info).not.toHaveBeenCalled();
        expect(layerService.selectBaseLayer).toHaveBeenCalled();
    }));

    it("should handle error and show toast error message", inject([DataContainerService, ShareUrlsService, ToastService], async (service: DataContainerService, shareUrlsService: ShareUrlsService, toastService: ToastService) => {
        spyOn(shareUrlsService, "getSelectedShareUrl").and.returnValue(null);
        spyOn(shareUrlsService, "setShareUrl");
        spyOn(toastService, "error");

        await service.setShareUrlAfterNavigation("123");

        expect(shareUrlsService.setShareUrl).toHaveBeenCalledWith(null);
        expect(toastService.error).toHaveBeenCalled();
    }));
});