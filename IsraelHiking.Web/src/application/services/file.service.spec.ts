import { TestBed, inject } from "@angular/core/testing";
import { HttpEventType, provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { StyleSpecification } from "maplibre-gl";

import { FileService, SaveAsFactory } from "./file.service";
import { ImageResizeService } from "./image-resize.service";
import { RunningContextService } from "./running-context.service";
import { SelectedRouteService } from "./selected-route.service";
import { FitBoundsService } from "./fit-bounds.service";
import { GpxDataContainerConverterService } from "./gpx-data-container-converter.service";
import { LoggingService } from "./logging.service";
import { ConnectionService } from "./connection.service";
import { ElevationProvider } from "./elevation.provider";
import { Urls } from "../urls";
import type { DataContainer, MarkerData, RouteData } from "../models";

describe("FileService", () => {

    let imageResizeService: ImageResizeService;
    let selectedRouteService: SelectedRouteService;
    let fitBoundsService: FitBoundsService;
    let saveAsSpy: jasmine.Spy;

    beforeEach(() => {
        saveAsSpy = jasmine.createSpy();
        imageResizeService = {
            resizeImageAndConvert: () => Promise.resolve({
                northEast: { lat: 0, lng: 0 },
                southWest: { lat: 1, lng: 1 },
                routes: [{ markers: [{} as MarkerData] }] as RouteData[]
            } as DataContainer)
        } as any as ImageResizeService;
        selectedRouteService = {
            addRoutes: jasmine.createSpy("addRoutes")
        } as any as SelectedRouteService;
        fitBoundsService = {
            fitBounds: jasmine.createSpy("fitBounds")
        } as any as FitBoundsService;
        const loggingServiceMock = {
            info: () => { },
            error: () => { },
        };
        TestBed.configureTestingModule({
            providers: [
                RunningContextService,
                GpxDataContainerConverterService,
                { provide: ConnectionService, useValue: { stateChanged: { subscribe: () => { } } } },
                { provide: LoggingService, useValue: loggingServiceMock },
                { provide: FitBoundsService, useValue: fitBoundsService },
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

    it("Should add routes from url", inject([FileService, HttpTestingController],
        async (service: FileService, mockBackend: HttpTestingController) => {

            const promise = service.addRoutesFromUrl("someurl");

            mockBackend.expectOne(Urls.files + "?url=someurl").flush({
                northEast: { lat: 1, lng: 1 }, southWest: { lat: 2, lng: 2 }
            });
            await promise;
            expect(selectedRouteService.addRoutes).toHaveBeenCalled();
        }));

    it("Should open from url by uploading", inject([FileService, HttpTestingController],
        async (service: FileService, mockBackend: HttpTestingController) => {

            const promise = service.addRoutesFromFile(new Blob([""]) as File);

            setTimeout(() => {
                mockBackend.expectOne(Urls.openFile).flush({
                    northEast: { lat: 0, lng: 0 },
                    southWest: { lat: 1, lng: 1 },
                    routes: [{
                        markers: [{}],
                    }]
                } as DataContainer);
            }, 1000);

            await promise;
            expect(selectedRouteService.addRoutes).toHaveBeenCalled();
        }
    ));

    it("Should open jpeg file and resize it", inject([FileService, HttpTestingController],
        async (service: FileService) => {
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
            target: { files: [{}], value: "123" },
        };
        const file = service.getFileFromEvent(event);

        expect(file).not.toBe(null);
        expect(event.target.value).toBe("");
    }));

    it("Should not get a files from event", inject([FileService], (service: FileService) => {
        const event = {
            target: { dataTransfer: [] as any[] },
        };
        const files = service.getFilesFromEvent(event);

        expect(files.length).toBe(0);
    }));

    it("Should get a files from event and clear input", inject([FileService], (service: FileService) => {
        const event = {
            target: { files: [{}], value: "123" },
        };
        const files = service.getFilesFromEvent(event);

        expect(files.length).toBe(1);
        expect(event.target.value).toBe("");
    }));

    it("Should get full URL", inject([FileService], (service: FileService) => {
        const url = service.getFullUrl("123");

        expect(url).toContain("/123");
    }));

    it("Should get style json content from remote source", inject([FileService, HttpTestingController],
        async (service: FileService, mockBackend: HttpTestingController) => {
            const promise = service.getStyleJsonContent("s.json", false);

            mockBackend.expectOne("s.json").flush({});

            const response = await promise;
            expect(response).toEqual({} as StyleSpecification);
        }));

    it("Should save log to zip file", inject([FileService], async (service: FileService) => {
        await service.saveLogToZipFile("something.zip", "some text");

        expect(saveAsSpy).toHaveBeenCalled();
    }));

    it("Should get file with progress", inject([FileService, HttpTestingController],
        async (service: FileService, mockBackend: HttpTestingController) => {
            const spy = jasmine.createSpy();
            const url = "http://123.gpx";
            const promise = service.getFileContentWithProgress(url, spy);

            const req = mockBackend.expectOne(url);
            req.event({ type: HttpEventType.DownloadProgress, loaded: 7, total: 10 });

            expect(spy).toHaveBeenCalled();

            req.event({ type: HttpEventType.Response, body: null, ok: true } as any);

            return promise;
        }));

    it("Should reject if response is no OK", inject([FileService, HttpTestingController],
        async (service: FileService, mockBackend: HttpTestingController) => {
            const spy = jasmine.createSpy();
            const url = "http://123.gpx";
            const promise = service.getFileContentWithProgress(url, spy);

            const req = mockBackend.expectOne(url);
            req.event({ type: HttpEventType.Response, body: null, ok: false } as any);

            await expectAsync(promise).toBeRejected();
        }));

    it("Should not download a file to cache due to network error", inject([FileService],
        async (service: FileService) => {
            const progressSpy = jasmine.createSpy();
            const url = "http://123.pmtiles";

            const mockResponse = { ok: false };

            const fetchSpy = spyOn(window, "fetch").and.returnValue(Promise.resolve(mockResponse as any));

            await expectAsync(service.downloadFileToCacheAuthenticated(url, url.split("/").pop(), null, progressSpy, new AbortController())).toBeRejected();

            expect(fetchSpy).toHaveBeenCalledTimes(1);
            expect(progressSpy).not.toHaveBeenCalled();
        }));

    it("Should download a file to cache without interruptions but without progress", inject([FileService],
        async (service: FileService) => {
            const progressSpy = jasmine.createSpy();
            const url = "http://123.pmtiles";
            const mockReader = {
                read: jasmine.createSpy("read").and.returnValues(
                    Promise.resolve({ done: false, value: new Uint8Array([1, 2]) }),
                    Promise.resolve({ done: false, value: new Uint8Array([3, 4]) }),
                    Promise.resolve({ done: true })
                ),
            };

            const mockResponse = {
                ok: true,
                body: {
                    getReader: jasmine.createSpy("getReader").and.returnValue(mockReader)
                },
                headers: {
                    get: jasmine.createSpy("get").and.returnValue("")
                }
            };

            // Mock fetch
            const fetchSpy = spyOn(window, "fetch").and.returnValue(Promise.resolve(mockResponse as any));


            await service.downloadFileToCacheAuthenticated(url, url.split("/").pop(), null, progressSpy, new AbortController());

            expect(fetchSpy).toHaveBeenCalledTimes(1);
            expect(mockReader.read).toHaveBeenCalledTimes(3);
            expect(progressSpy).not.toHaveBeenCalled();
        }));

    it("Should stop download a file to cache when interrupted", inject([FileService],
        async (service: FileService) => {
            const progressSpy = jasmine.createSpy();
            const url = "http://123.pmtiles";
            const mockReader = {
                read: jasmine.createSpy("read").and.returnValues(
                    Promise.resolve({ done: false, value: new Uint8Array([1, 2]) }),
                    new Promise(resolve => setTimeout(() => { resolve({ done: false, value: new Uint8Array([3, 4]) }); }, 100)),
                    new Promise(resolve => setTimeout(() => { resolve({ done: true }); }, 100))
                ),
            };

            const mockResponse = {
                ok: true,
                body: {
                    getReader: jasmine.createSpy("getReader").and.returnValue(mockReader)
                },
                headers: {
                    get: jasmine.createSpy("get").and.returnValue("4")
                }
            };

            // Mock fetch
            const fetchSpy = spyOn(window, "fetch").and.returnValue(Promise.resolve(mockResponse as any));

            const abortController = new AbortController();
            const promise = service.downloadFileToCacheAuthenticated(url, url.split("/").pop(), null, progressSpy, abortController);

            await new Promise(resolve => setTimeout(resolve, 50));
            abortController.abort();

            await promise;

            expect(fetchSpy).toHaveBeenCalledTimes(1);
            expect(mockReader.read).toHaveBeenCalledTimes(2);
            expect(progressSpy).toHaveBeenCalledTimes(1);
        }));

    it("Should not throw if delete file fails", inject([FileService],
        async (service: FileService) => {
            await expectAsync(service.deleteFileInDataDirectory("file")).toBeResolved();
        }
    ));
});
