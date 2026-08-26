import { describe, beforeEach, vi, it, expect } from "vitest";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { decode, encode } from "base64-arraybuffer";
import { TestBed, inject } from "@angular/core/testing";
import { provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";

import { FileService, type HTMLElementInputChangeEvent } from "./file.service";
import { ImageResizeService } from "./image-resize.service";
import { RunningContextService } from "./running-context.service";
import { SelectedRouteService } from "./selected-route.service";
import { MapService } from "./map.service";
import { GpxDataContainerConverterService } from "./gpx-data-container-converter.service";
import { LoggingService } from "./logging.service";
import { ElevationProvider } from "./elevation.provider";
import { Urls } from "../urls";
import type { DataContainer, MarkerData, RouteData } from "../models";

/** Stands in for the native downloader, so that the events it sends can be played out by hand */
const downloader = vi.hoisted(() => {
    const listeners: Record<string, ((event: unknown) => void)[]> = {};
    return {
        emit: (eventName: string, event: unknown) => (listeners[eventName] ?? []).forEach(listener => listener(event)),
        plugin: {
            addListener: (eventName: string, listenerFunc: (event: unknown) => void) => {
                listeners[eventName] = [...listeners[eventName] ?? [], listenerFunc];
                return Promise.resolve({
                    remove: () => {
                        listeners[eventName] = listeners[eventName].filter(listener => listener !== listenerFunc);
                        return Promise.resolve();
                    }
                });
            },
            download: vi.fn((options: { id: string; url: string; destination: string; headers: Record<string, string> }) =>
                Promise.resolve({ id: options.id, progress: 0, state: "RUNNING" })),
            stop: vi.fn(() => Promise.resolve())
        }
    };
});

vi.mock("@capgo/capacitor-downloader", () => ({ CapacitorDownloader: downloader.plugin }));

describe("FileService", () => {
    beforeEach(() => {
        const imageResizeService = {
            resizeImageAndConvert: () =>
                Promise.resolve({
                    northEast: { lat: 0, lng: 0 },
                    southWest: { lat: 1, lng: 1 },
                    routes: [{ markers: [{} as MarkerData] }] as RouteData[]
                } as DataContainer)
        } as unknown as ImageResizeService;
        const selectedRouteService = {
            addRoutes: vi.fn()
        } as unknown as SelectedRouteService;
        const mapService = {
            fitBounds: vi.fn()
        } as unknown as MapService;
        const loggingServiceMock = {
            info: () => { },
            debug: () => { },
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
                FileService,
                provideHttpClient(withInterceptorsFromDi()),
                provideHttpClientTesting()
            ]
        });
    });

    it("Should save to file on web", inject([FileService, HttpTestingController],
        async (service: FileService, mockBackend: HttpTestingController) => {
            const anchorClickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => { });
            const promise = service.saveToFile("file.name", "format", {} as DataContainer);

            mockBackend.expectOne(Urls.files + "?format=format").flush(btoa("bytes"));
            await promise;
            expect(anchorClickSpy).toHaveBeenCalled();
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
        const files = service.getFilesFromEvent({ target: { files: [] } } as unknown as Event);

        expect(files).toHaveLength(0);
    }));

    it("Should not get a files from event", inject([FileService], (service: FileService) => {
        const event = {
            target: { dataTransfer: [] as DataTransferItem[] }
        } as unknown as Event;
        const files = service.getFilesFromEvent(event);

        expect(files.length).toBe(0);
    }));

    it("Should get a files from event and clear input", inject([FileService], (service: FileService) => {
        const event = {
            target: { files: [{}], value: "123" }
        } as unknown as HTMLElementInputChangeEvent;
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
        const anchorClickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => { });

        await service.saveLogToZipFile("something.zip", "some text");

        expect(anchorClickSpy).toHaveBeenCalled();
    }));

    it("Should not download a file to cache due to network error", inject([FileService],
        async (service: FileService) => {
            const progressSpy = vi.fn();
            const url = "http://123.pmtiles";

            const mockResponse = { ok: false };

            const fetchSpy = vi.spyOn(window, "fetch").mockReturnValue(Promise.resolve(mockResponse as unknown as Response));

            await expect(service.downloadFileToCacheAuthenticated(url, url.split("/").pop(), null, progressSpy, new AbortController())).rejects.toThrow();

            expect(fetchSpy).toHaveBeenCalledTimes(1);
            expect(progressSpy).not.toHaveBeenCalled();
            fetchSpy.mockRestore();
        }
    ));

    it("Should report a file as whole when the server did not report its length", inject([FileService],
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
                .mockReturnValue(Promise.resolve(mockResponse as unknown as Response));

            await service.downloadFileToCacheAuthenticated(url, url.split("/").pop(), null, progressSpy, new AbortController());

            expect(fetchSpy).toHaveBeenCalledTimes(1);
            expect(mockReader.read).toHaveBeenCalledTimes(3);
            expect(progressSpy).toHaveBeenLastCalledWith(1);
            fetchSpy.mockRestore();
        }
    ));

    it("Should download a file with the native downloader on ios and move it into the offline cache", async () => {
        TestBed.overrideProvider(RunningContextService, { useValue: { isIos: true, isCapacitor: true } });
        const service = TestBed.inject(FileService);
        const progressSpy = vi.fn();

        const promise = service.downloadFileToCacheAuthenticated(
            "http://123.tar", "native.tar", "token", progressSpy, new AbortController());
        // The download only starts once the cache directory is there and the listeners are registered
        while (downloader.plugin.download.mock.calls.length === 0) {
            await new Promise(resolve => setTimeout(resolve));
        }

        const options = downloader.plugin.download.mock.calls[0][0];
        expect(options.headers.Authorization).toBe("Bearer token");
        expect(options.destination).toContain(options.id);
        // The plugin writes the file itself, which is what it does once it downloaded it
        await Filesystem.writeFile({
            path: `offline-files/${options.id}`,
            directory: Directory.Cache,
            data: encode(new Uint8Array([1, 2, 3, 4]).buffer)
        });
        downloader.emit("downloadProgress", { id: options.id, progress: 1, bytesWritten: 4, bytesTotal: 4 });
        downloader.emit("downloadCompleted", { id: options.id });
        await promise;

        expect(progressSpy).toHaveBeenCalledWith(1);
        const written = await Filesystem.readFile({ path: "offline-files/native.tar", directory: Directory.Cache });
        expect(new Uint8Array(decode(written.data as string))).toEqual(new Uint8Array([1, 2, 3, 4]));
    });

    it("Should write every byte of the chunks it gathered", inject([FileService],
        async (service: FileService) => {
            const url = "http://123.pmtiles";
            // A chunk that is a view into a larger buffer, only its own bytes should be written
            const chunkWithinALargerBuffer = new Uint8Array(new Uint8Array([1, 2, 3, 4, 5, 6]).buffer, 2, 2);
            const mockReader = {
                read: vi
                    .fn()
                    .mockReturnValueOnce(Promise.resolve({ done: false, value: new Uint8Array([1, 2]) }))
                    .mockReturnValueOnce(Promise.resolve({ done: false, value: chunkWithinALargerBuffer }))
                    .mockReturnValueOnce(Promise.resolve({ done: true }))
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

            const fetchSpy = vi.spyOn(window, "fetch").mockReturnValue(Promise.resolve(mockResponse as unknown as Response));

            await service.downloadFileToCacheAuthenticated(url, "gathered.pmtiles", null, vi.fn(), new AbortController());

            const written = await Filesystem.readFile({ path: "offline-files/gathered.pmtiles", directory: Directory.Cache });
            expect(new Uint8Array(decode(written.data as string))).toEqual(new Uint8Array([1, 2, 3, 4]));
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
            const fetchSpy = vi.spyOn(window, "fetch").mockReturnValue(Promise.resolve(mockResponse as unknown as Response));

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
