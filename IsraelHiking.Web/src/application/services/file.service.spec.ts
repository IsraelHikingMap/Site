import { describe, beforeEach, vi, it, expect } from "vitest";
import { Directory, Filesystem } from "@capacitor/filesystem";
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
            warning: () => { },
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

            (await vi.waitFor(() => mockBackend.expectOne("s.json"))).flush({});

            const response = await promise;
            expect(response).toEqual("{}");
        }
    ));

    it("Should fall back to the style that was fetched before when it can not be fetched now",
        inject([FileService, HttpTestingController, RunningContextService],
            async (service: FileService, mockBackend: HttpTestingController, runningContextService: RunningContextService) => {
                (runningContextService as unknown as { isCapacitor: boolean }).isCapacitor = true;

                const firstPromise = service.getStyleJsonContent("https://example.com/kept.json", false);
                (await vi.waitFor(() => mockBackend.expectOne("https://example.com/kept.json"))).flush({ kept: true });
                await firstPromise;

                const secondPromise = service.getStyleJsonContent("https://example.com/kept.json", false);
                (await vi.waitFor(() => mockBackend.expectOne("https://example.com/kept.json"))).error(new ProgressEvent("error"));

                expect(JSON.parse(await secondPromise)).toEqual({ kept: true });
            }
        )
    );

    it("Should prefer the style from the network over the one on the device, so a style that changed is not missed",
        inject([FileService, HttpTestingController, RunningContextService],
            async (service: FileService, mockBackend: HttpTestingController, runningContextService: RunningContextService) => {
                (runningContextService as unknown as { isCapacitor: boolean }).isCapacitor = true;
                await service.writeStyle("changed.json", "{\"old\": true}");

                const promise = service.getStyleJsonContent("https://example.com/changed.json", true);
                (await vi.waitFor(() => mockBackend.expectOne("https://example.com/changed.json"))).flush({ fresh: true });

                expect(JSON.parse(await promise)).toEqual({ fresh: true });
            }
        )
    );

    it("Should use the style an offline download wrote when a built in base layer can not be fetched",
        inject([FileService, HttpTestingController, RunningContextService],
            async (service: FileService, mockBackend: HttpTestingController, runningContextService: RunningContextService) => {
                (runningContextService as unknown as { isCapacitor: boolean }).isCapacitor = true;
                await service.writeStyle("downloaded.json", "{\"downloaded\": true}");

                const promise = service.getStyleJsonContent("https://example.com/downloaded.json", true);
                (await vi.waitFor(() => mockBackend.expectOne("https://example.com/downloaded.json"))).error(new ProgressEvent("error"));

                expect(JSON.parse(await promise)).toEqual({ downloaded: true });
            }
        )
    );

    it("Should not keep the style of a built in base layer, it needs to match the offline tiles",
        inject([FileService, HttpTestingController, RunningContextService],
            async (service: FileService, mockBackend: HttpTestingController, runningContextService: RunningContextService) => {
                (runningContextService as unknown as { isCapacitor: boolean }).isCapacitor = true;

                const firstPromise = service.getStyleJsonContent("https://example.com/built-in.json", true);
                (await vi.waitFor(() => mockBackend.expectOne("https://example.com/built-in.json"))).flush({ builtIn: true });
                await firstPromise;

                const secondPromise = service.getStyleJsonContent("https://example.com/built-in.json", true);
                (await vi.waitFor(() => mockBackend.expectOne("https://example.com/built-in.json"))).error(new ProgressEvent("error"));

                expect(JSON.parse(await secondPromise)).toEqual({ version: 8, layers: [], sources: {} });
            }
        )
    );

    it("Should return an empty style when it is neither online nor on the device",
        inject([FileService, HttpTestingController, RunningContextService],
            async (service: FileService, mockBackend: HttpTestingController, runningContextService: RunningContextService) => {
                (runningContextService as unknown as { isCapacitor: boolean }).isCapacitor = true;

                const promise = service.getStyleJsonContent("https://example.com/never-fetched.json", false);
                (await vi.waitFor(() => mockBackend.expectOne("https://example.com/never-fetched.json"))).error(new ProgressEvent("error"));

                expect(JSON.parse(await promise)).toEqual({ version: 8, layers: [], sources: {} });
            }
        )
    );

    it("Should only list the offline map files that are in the data directory", inject([FileService],
        async (service: FileService) => {
            await service.writeStyle("not-a-map.json", "{}");
            await Filesystem.writeFile({ path: "a-map+7-76-51.pmtiles", data: "AA==", directory: Directory.Data });

            const files = await service.listOfflineFilesInDataDirectory();

            expect(files.map(f => f.fileName)).toEqual(["a-map+7-76-51.pmtiles"]);
            await Filesystem.deleteFile({ path: "a-map+7-76-51.pmtiles", directory: Directory.Data });
        }
    ));

    it("Should save log to zip file", inject([FileService], async (service: FileService) => {
        const anchorClickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => { });

        await service.saveLogToZipFile("something.zip", "some text");

        expect(anchorClickSpy).toHaveBeenCalled();
    }));

    it("Should not throw if delete file fails", inject([FileService],
        async (service: FileService) => {
            await expect(service.deleteFileInDataDirectory("file")).resolves.not.toThrow();
        }
    ));
});
