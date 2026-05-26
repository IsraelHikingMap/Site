import { describe, beforeEach, vi, it, expect, type Mock } from "vitest";
import { TestBed, inject } from "@angular/core/testing";
import { HttpEventType, provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";

import { FileService, SaveAsFactory } from "./file.service";
import { ImageResizeService } from "./image-resize.service";
import { RunningContextService } from "./running-context.service";
import { SelectedRouteService } from "./selected-route.service";
import { MapService } from "./map.service";
import { GpxDataContainerConverterService } from "./gpx-data-container-converter.service";
import { LoggingService } from "./logging.service";
import { ElevationProvider } from "./elevation.provider";
import { Urls } from "../urls";
import type { DataContainer, MarkerData, RouteData } from "../models";

describe("FileService", () => {
    let saveAsSpy: Mock;

    beforeEach(() => {
        saveAsSpy = vi.fn();
        const imageResizeService = {
            resizeImageAndConvert: () =>
                Promise.resolve({
                    northEast: { lat: 0, lng: 0 },
                    southWest: { lat: 1, lng: 1 },
                    routes: [{ markers: [{} as MarkerData] }] as RouteData[]
                } as DataContainer)
        } as any as ImageResizeService;
        const selectedRouteService = {
            addRoutes: vi.fn()
        } as any as SelectedRouteService;
        const mapService = {
            fitBounds: vi.fn()
        } as any as MapService;
        const loggingServiceMock = {
            info: () => { },
            error: () => { }
        };
        TestBed.configureTestingModule({
            providers: [
                RunningContextService,
                GpxDataContainerConverterService,
                { provide: LoggingService, useValue: loggingServiceMock },
                { provide: MapService, useValue: mapService },
                { provide: SelectedRouteService, useValue: selectedRouteService },
                { provide: ImageResizeService, useValue: imageResizeService },
                { provide: ElevationProvider, useValue: {} },
                { provide: SaveAsFactory, useFactory: () => saveAsSpy },
                FileService,
                provideHttpClient(withInterceptorsFromDi()),
                provideHttpClientTesting()
            ]
        });
    });

    it("Should save to file on web", inject([FileService, HttpTestingController],
        async (service: FileService, mockBackend: HttpTestingController) => {
            const promise = service.saveToFile("file.name", "format", {} as DataContainer);

            mockBackend.expectOne(Urls.files + "?format=format").flush(btoa("bytes"));
            await promise;
            expect(saveAsSpy).toHaveBeenCalled();
        }
    ));

    it("Should add routes from url", inject([FileService, HttpTestingController, SelectedRouteService],
        async (service: FileService, mockBackend: HttpTestingController, selectedRouteService: SelectedRouteService) => {
            const promise = service.addRoutesFromUrl("someurl");

            mockBackend.expectOne(Urls.files + "?url=someurl").flush({
                northEast: { lat: 1, lng: 1 },
                southWest: { lat: 2, lng: 2 }
            });
            await promise;
            expect(selectedRouteService.addRoutes).toHaveBeenCalled();
        }
    ));

    it("Should open from url by uploading", inject([FileService, HttpTestingController, SelectedRouteService],
        async (service: FileService, mockBackend: HttpTestingController, selectedRouteService: SelectedRouteService) => {
            const promise = service.addRoutesFromFile(new Blob([""]) as File);

            setTimeout(() => {
                mockBackend.expectOne(Urls.openFile).flush({
                    northEast: { lat: 0, lng: 0 },
                    southWest: { lat: 1, lng: 1 },
                    routes: [
                        {
                            markers: [{}]
                        }
                    ]
                } as DataContainer);
            }, 1000);

            await promise;
            expect(selectedRouteService.addRoutes).toHaveBeenCalled();
        }
    ));

    it("Should open jpeg file and resize it", inject([FileService, SelectedRouteService],
        async (service: FileService, selectedRouteService: SelectedRouteService) => {
            const file = new Blob([""], { type: ImageResizeService.JPEG }) as File;
            await service.addRoutesFromFile(file);
            expect(selectedRouteService.addRoutes).toHaveBeenCalled();
        }
    ));

    it("Should not get a file from event when there's no files", inject([FileService], (service: FileService) => {
        const file = service.getFileFromEvent({ target: { files: [] } });

        expect(file).toBe(null);
    }));

    it("Should get a file from event and clear input", inject([FileService], (service: FileService) => {
        const event = {
            target: { files: [{}], value: "123" }
        };
        const file = service.getFileFromEvent(event);

        expect(file).not.toBe(null);
        expect(event.target.value).toBe("");
    }));

    it("Should not get a files from event", inject([FileService], (service: FileService) => {
        const event = {
            target: { dataTransfer: [] as any[] }
        };
        const files = service.getFilesFromEvent(event);

        expect(files.length).toBe(0);
    }));

    it("Should get a files from event and clear input", inject([FileService], (service: FileService) => {
        const event = {
            target: { files: [{}], value: "123" }
        };
        const files = service.getFilesFromEvent(event);

        expect(files.length).toBe(1);
        expect(event.target.value).toBe("");
    }));

    it("Should get style json content from remote source", inject([FileService, HttpTestingController],
        async (service: FileService, mockBackend: HttpTestingController) => {
            const promise = service.getStyleJsonContent("s.json", false);

            mockBackend.expectOne("s.json").flush({});

            const response = await promise;
            expect(response).toEqual("{}");
        }
    ));

    it("Should save log to zip file", inject([FileService], async (service: FileService) => {
        await service.saveLogToZipFile("something.zip", "some text");

        expect(saveAsSpy).toHaveBeenCalled();
    }));

    it("Should get file with progress", inject([FileService, HttpTestingController],
        async (service: FileService, mockBackend: HttpTestingController) => {
            const spy = vi.fn();
            const url = "http://123.gpx";
            const promise = service.getFileContentWithProgress(url, spy);

            const req = mockBackend.expectOne(url);
            req.event({ type: HttpEventType.DownloadProgress, loaded: 7, total: 10 });

            expect(spy).toHaveBeenCalled();

            req.event({ type: HttpEventType.Response, body: null, ok: true } as any);

            return promise;
        }
    ));

    it("Should reject if response is no OK", inject([FileService, HttpTestingController],
        async (service: FileService, mockBackend: HttpTestingController) => {
            const spy = vi.fn();
            const url = "http://123.gpx";
            const promise = service.getFileContentWithProgress(url, spy);

            const req = mockBackend.expectOne(url);
            req.event({ type: HttpEventType.Response, body: null, ok: false } as any);

            await expect(promise).rejects.toThrow();
        }
    ));

    it("Should not download a file to cache due to network error", inject([FileService],
        async (service: FileService) => {
            const progressSpy = vi.fn();
            const url = "http://123.pmtiles";

            const mockResponse = { ok: false };

            const fetchSpy = vi.spyOn(window, "fetch").mockReturnValue(Promise.resolve(mockResponse as any));

            await expect(service.downloadFileToCacheAuthenticated(url, url.split("/").pop(), null, progressSpy, new AbortController())).rejects.toThrow();

            expect(fetchSpy).toHaveBeenCalledTimes(1);
            expect(progressSpy).not.toHaveBeenCalled();
            fetchSpy.mockRestore();
        }
    ));

    it("Should download a file to cache without interruptions but without progress", inject([FileService],
        async (service: FileService) => {
            const progressSpy = vi.fn();
            const url = "http://123.pmtiles";
            const mockReader = {
                read: vi
                    .fn()
                    .mockReturnValueOnce(Promise.resolve({ done: false, value: new Uint8Array([1, 2]) }))
                    .mockReturnValueOnce(Promise.resolve({ done: false, value: new Uint8Array([3, 4]) }))
                    .mockReturnValueOnce(Promise.resolve({ done: true }))
            };

            const mockResponse = {
                ok: true,
                body: {
                    getReader: vi.fn().mockReturnValue(mockReader)
                },
                headers: {
                    get: vi.fn().mockReturnValue("")
                }
            };

            // Mock fetch
            const fetchSpy = vi
                .spyOn(window, "fetch")
                .mockReturnValue(Promise.resolve(mockResponse as any));

            await service.downloadFileToCacheAuthenticated(url, url.split("/").pop(), null, progressSpy, new AbortController());

            expect(fetchSpy).toHaveBeenCalledTimes(1);
            expect(mockReader.read).toHaveBeenCalledTimes(3);
            expect(progressSpy).not.toHaveBeenCalled();
            fetchSpy.mockRestore();
        }
    ));

    it("Should stop download a file to cache when interrupted", inject([FileService],
        async (service: FileService) => {
            const progressSpy = vi.fn();
            const url = "http://123.pmtiles";
            const mockReader = {
                read: vi
                    .fn()
                    .mockReturnValueOnce(Promise.resolve({ done: false, value: new Uint8Array([1, 2]) }))
                    .mockReturnValueOnce(new Promise((resolve) => setTimeout(() => resolve({ done: false, value: new Uint8Array([3, 4]) }), 100)))
                    .mockReturnValueOnce(new Promise((resolve) => setTimeout(() => resolve({ done: true }), 100)))
            };

            const mockResponse = {
                ok: true,
                body: {
                    getReader: vi.fn().mockReturnValue(mockReader)
                },
                headers: {
                    get: vi.fn().mockReturnValue("4")
                }
            };

            // Mock fetch
            const fetchSpy = vi.spyOn(window, "fetch").mockReturnValue(Promise.resolve(mockResponse as any));

            const abortController = new AbortController();
            const promise = service.downloadFileToCacheAuthenticated(url, url.split("/").pop(), null, progressSpy, abortController);

            await new Promise((resolve) => setTimeout(resolve, 50));
            abortController.abort();

            await promise;

            expect(fetchSpy).toHaveBeenCalledTimes(1);
            expect(mockReader.read).toHaveBeenCalledTimes(2);
            expect(progressSpy).toHaveBeenCalledTimes(1);
            fetchSpy.mockRestore();
        }
    ));

    it("Should not throw if delete file fails", inject([FileService],
        async (service: FileService) => {
            await expect(service.deleteFileInDataDirectory("file")).resolves.not.toThrow();
        }
    ));
});
