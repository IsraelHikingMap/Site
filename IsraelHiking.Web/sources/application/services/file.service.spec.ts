import { TestBed, inject, fakeAsync } from "@angular/core/testing";
import { HttpClientModule, HttpClient } from "@angular/common/http";
import { HttpClientTestingModule, HttpTestingController } from "@angular/common/http/testing";
import { Device } from "@ionic-native/device/ngx";

import { FileService, IFormatViewModel } from "./file.service";
import { NonAngularObjectsFactory } from "./non-angular-objects.factory";
import { ImageResizeService } from "./image-resize.service";
import { Urls } from "../urls";
import { DataContainer, MarkerData, RouteData } from "../models/models";
import { RunningContextService } from "./running-context.service";
import { SelectedRouteService } from "./layers/routelayers/selected-route.service";
import { FitBoundsService } from "./fit-bounds.service";
import { LoggingService } from "./logging.service";

describe("FileService", () => {

    let imageResizeService: ImageResizeService;
    let nonAngularObjectsFactory: NonAngularObjectsFactory;
    let selectedRouteService: SelectedRouteService;
    let fitBoundsService: FitBoundsService;

    beforeEach(() => {
        imageResizeService = {
            resizeImageAndConvert: jasmine.createSpy("resizeImageAndConvert")
        } as any as ImageResizeService;
        nonAngularObjectsFactory = {
            saveAsWrapper: jasmine.createSpy("saveAsWrapper"),
            b64ToBlob: jasmine.createSpy("b64ToBlob"),
        } as any as NonAngularObjectsFactory;
        selectedRouteService = {
            addRoutes: jasmine.createSpy("addRoutes")
        } as any as SelectedRouteService;
        fitBoundsService = {
            fitBounds: jasmine.createSpy("fitBounds")
        } as any as FitBoundsService;
        TestBed.configureTestingModule({
            imports: [
                HttpClientModule,
                HttpClientTestingModule
            ],
            providers: [
                RunningContextService,
                Device,
                LoggingService,
                {
                    provide: FileService,
                    useFactory: fakeAsync((http, mockBackend: HttpTestingController,
                                           runningContextService: RunningContextService, loggingService: LoggingService) => {
                        let fileService = new FileService(http,
                            null,
                            null,
                            null,
                            runningContextService,
                            imageResizeService,
                            nonAngularObjectsFactory,
                            selectedRouteService,
                            fitBoundsService,
                            loggingService,
                            null);
                        return fileService;
                    }),
                    deps: [HttpClient, HttpTestingController, RunningContextService, LoggingService]
                }
            ]
        });
    });

    it("Should Initialize with file formats", inject([FileService, HttpTestingController],
        (fileService: FileService, mockBackend: HttpTestingController) => {
            fileService.initialize().then(() => {
                expect(fileService.formats.length).toBe(2);
            });
            mockBackend.expectOne(Urls.fileFormats).flush([{
                extension: "ex",
                label: "label",
                outputFormat: "output"
            } as IFormatViewModel]);

        }));

    it("Should save to file", inject([FileService, HttpTestingController],
        async (fileService: FileService, mockBackend: HttpTestingController) => {

            let promise = fileService.saveToFile("file.name", "format", {} as DataContainer).then(() => {
                expect(nonAngularObjectsFactory.saveAsWrapper).toHaveBeenCalled();
                expect(nonAngularObjectsFactory.b64ToBlob).toHaveBeenCalled();
            });

            mockBackend.expectOne(Urls.files + "?format=format").flush(btoa("bytes"));
            return promise;
        }));

    it("Should open from file", inject([FileService, HttpTestingController],
        async (fileService: FileService, mockBackend: HttpTestingController) => {

            let promise = fileService.openFromUrl("someurl").then((res) => {
                expect(res).not.toBeNull();
            }, fail);

            mockBackend.expectOne(Urls.files + "?url=someurl").flush(btoa("bytes"));
            return promise;
        }));

    it("Should open from url by uploading", inject([FileService, HttpTestingController],
        async (fileService: FileService, mockBackend: HttpTestingController) => {

            let promise = fileService.addRoutesFromFile(new Blob([""]) as File).then(() => {
                expect(selectedRouteService.addRoutes).toHaveBeenCalled();
            }, fail);

            mockBackend.expectOne(Urls.openFile).flush({
                northEast: { lat: 0, lng: 0 },
                southWest: { lat: 1, lng: 1 }
            } as DataContainer);
            return promise;
        }));

    it("Should open jpeg file and resize it", inject([FileService, HttpTestingController],
        async (fileService: FileService) => {
            let file = new Blob([""], { type: "image/jpeg" }) as File;
            imageResizeService.resizeImageAndConvert = () => Promise.resolve({
                northEast: { lat: 0, lng: 0 },
                southWest: { lat: 1, lng: 1 },
                routes: [{ markers: [{} as MarkerData] }] as RouteData[]
            } as DataContainer);
            let promise = fileService.addRoutesFromFile(file).then(() => {
                expect(selectedRouteService.addRoutes).toHaveBeenCalled();
            }, fail);

            return promise;
        }));

    it("Should not get a file from event when there's no files", inject([FileService], (fileService: FileService) => {
        let file = fileService.getFileFromEvent({ target: { files: [] } });

        expect(file).toBe(null);
    }));

    it("Should get a file from event and clear input", inject([FileService], (fileService: FileService) => {
        let event = {
            target: { files: [{}], value: "123" },
        };
        let file = fileService.getFileFromEvent(event);

        expect(file).not.toBe(null);
        expect(event.target.value).toBe("");
    }));

    it("Should not get a files from event", inject([FileService], (fileService: FileService) => {
        let event = {
            target: { dataTransfer: [] },
        };
        let files = fileService.getFilesFromEvent(event);

        expect(files.length).toBe(0);
    }));

    it("Should get a files from event and clear input", inject([FileService], (fileService: FileService) => {
        let event = {
            target: { files: [{}], value: "123" },
        };
        let files = fileService.getFilesFromEvent(event);

        expect(files.length).toBe(1);
        expect(event.target.value).toBe("");
    }));
});
