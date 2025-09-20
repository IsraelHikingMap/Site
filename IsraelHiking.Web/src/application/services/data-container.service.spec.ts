import { inject, TestBed } from "@angular/core/testing";
import { vi, expect, it, describe, beforeEach } from "vitest";
import { NgxsModule, Store } from "@ngxs/store";

import { RoutesReducer } from "../reducers/routes.reducer";
import { DataContainerService } from "./data-container.service";
import { ShareUrlsService } from "./share-urls.service";
import { LayersService } from "./layers.service";
import { FileService } from "./file.service";
import { ResourcesService } from "./resources.service";
import { ToastService } from "./toast.service";
import { FitBoundsService } from "./fit-bounds.service";
import { SelectedRouteService } from "./selected-route.service";
import { RoutesFactory } from "./routes.factory";
import { MapService } from "./map.service";
import { RunningContextService } from "./running-context.service";
import type { ShareUrl } from "../models";

describe("DataContainerService", () => {
    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [NgxsModule.forRoot([RoutesReducer])],
            providers: [
                DataContainerService,
                RoutesFactory,
                { provide: ShareUrlsService, useValue: {
                    getSelectedShareUrl: () => {},
                    setShareUrlById: () => {},
                    setShareUrl: () => {}
                } },
                { provide: LayersService, useValue: {
                    addExternalOverlays: vi.fn(),
                    addExternalBaseLayer: vi.fn(),
                    getData: () => ({})
                } },
                { provide: FileService, useValue: {
                    openFromUrl: () => {}
                } },
                { provide: ResourcesService, useValue: {} },
                { provide: ToastService, useValue: {
                    info: () => {},
                    error: () => {},
                    warning: () => {}
                } },
                { provide: FitBoundsService, useValue: {
                    fitBounds: vi.fn()
                } },
                { provide: SelectedRouteService, useValue: {
                    getSelectedRoute: () => null as any
                } },
                { provide: MapService, useValue: {
                    map: {
                        getBounds: () => ({ getNorthEast: () => ({ lat: 1, lng: 2 }), getSouthWest: () => ({ lat: 3, lng: 4 }) })
                    }
                } },
                { provide: RunningContextService, useValue: {} }
            ]
        });
    });

    it("should get data", inject([DataContainerService, Store], (service: DataContainerService, store: Store) => {
        store.reset({
            routes: {
                present: [{
                    state: "Hidden",
                    segments: [{}]
                }, {
                    state: "Poi",
                    markers: [{}],
                    segments: []
                }]
            }
        });
        const dataContainer = service.getData(true);
        expect(dataContainer.routes.length).toBe(2);
    }));

    it("should return all routes for file export when no route is selected", inject([DataContainerService, Store], (service: DataContainerService, store: Store) => {
        store.reset({
            routes: {
                present: [{
                    state: "Hidden",
                    segments: [{}]
                }, {
                    state: "Poi",
                    markers: [{}],
                    segments: []
                }]
            }
        });
        const dataContainer = service.getDataForFileExport();
        expect(dataContainer.routes.length).toBe(1);
    }));

    it("should return all routes for file export when no route is selected", inject([DataContainerService, SelectedRouteService], (service: DataContainerService, selectedRouteService: SelectedRouteService) => {
        selectedRouteService.getSelectedRoute = () => ({ segments: [{}] } as any);
        const dataContainer = service.getDataForFileExport();
        expect(dataContainer.routes.length).toBe(1);
    }));

    it("should return true if there are hidden routes in the store", inject([DataContainerService, Store], (service: DataContainerService, store: Store) => {
        store.reset({
            routes: {
                present: [
                    { id: "1", state: "Hidden" },
                    { id: "2", state: "Poi" }
                ]
            }
        })
        expect(service.hasHiddenRoutes()).toBeTruthy();
    }));

    it("should return if the share URL is already selected", inject([DataContainerService, ShareUrlsService], async (service: DataContainerService, shareUrlsService: ShareUrlsService) => {
        vi.spyOn(shareUrlsService, "getSelectedShareUrl").mockReturnValue({ id: "123" } as any);
        vi.spyOn(shareUrlsService, "setShareUrlById");

        await service.setShareUrlAfterNavigation("123");

        expect(shareUrlsService.setShareUrlById).not.toHaveBeenCalled();
    }));

    it("should set share URL and show toast message if not in iframe", inject([DataContainerService, ShareUrlsService, ToastService, RunningContextService, FitBoundsService], async (service: DataContainerService, shareUrlsService: ShareUrlsService, toastService: ToastService, runningContextService: RunningContextService, fitBoundsService: FitBoundsService) => {
        const shareUrl = { id: "123", dataContainer: {
            routes: [],
            northEast: { lat: 1, lng: 2 },
            southWest: { lat: 3, lng: 4 }
        }, description: "desc", title: "title" } as ShareUrl;
        vi.spyOn(shareUrlsService, "getSelectedShareUrl").mockReturnValue(null);
        vi.spyOn(shareUrlsService, "setShareUrlById").mockReturnValue(Promise.resolve(shareUrl));
        vi.spyOn(toastService, "info");
        (runningContextService as any).isIFrame = false;
        await service.setShareUrlAfterNavigation("42");

        expect(shareUrlsService.setShareUrlById).toHaveBeenCalledWith("42");
        expect(toastService.info).toHaveBeenCalledWith("desc", "title");
        expect(fitBoundsService.fitBounds).toHaveBeenCalled();
    }));

    it("should set file url after navigation", inject([DataContainerService, FileService, ToastService], async (service: DataContainerService, fileService: FileService, toastService: ToastService) => {
        vi.spyOn(fileService, "openFromUrl").mockReturnValue(Promise.resolve({} as any));
        vi.spyOn(toastService, "warning");
        await service.setFileUrlAfterNavigation("url", "baseLayer");

        expect(toastService.warning).toHaveBeenCalled();
    }));

    /* HM TODO: bring this back?
    it("should set share URL and not show toast message if in iframe", async () => {
        runningContextService.isIFrame = true;
        const shareUrl = { id: "123", dataContainer: {}, description: "desc", title: "title" };
        shareUrlsService.getSelectedShareUrl.and.returnValue(null);
        shareUrlsService.setShareUrlById.and.returnValue(Promise.resolve(shareUrl));

        await service.setShareUrlAfterNavigation("123");

        expect(shareUrlsService.setShareUrlById).toHaveBeenCalledWith("123");
        expect(toastService.info).not.toHaveBeenCalled();
    });

    it("should handle error and show toast error message", async () => {
        shareUrlsService.getSelectedShareUrl.and.returnValue(null);
        shareUrlsService.setShareUrlById.and.returnValue(Promise.reject("error"));

        await service.setShareUrlAfterNavigation("123");

        expect(shareUrlsService.setShareUrl).toHaveBeenCalledWith(null);
        expect(toastService.error).toHaveBeenCalled();
    });
    */
});