import { TestBed, inject } from "@angular/core/testing";
import { HttpClientModule } from "@angular/common/http";
import { HttpClientTestingModule, HttpTestingController } from "@angular/common/http/testing";
import { File as FileSystemWrapper } from "@awesome-cordova-plugins/file/ngx";
import { FileTransfer } from "@awesome-cordova-plugins/file-transfer/ngx";
import { SocialSharing } from "@awesome-cordova-plugins/social-sharing/ngx";

import { FileService } from "./file.service";
import { NonAngularObjectsFactory } from "./non-angular-objects.factory";
import { ImageResizeService } from "./image-resize.service";
import { RunningContextService } from "./running-context.service";
import { SelectedRouteService } from "./selected-route.service";
import { FitBoundsService } from "./fit-bounds.service";
import { GpxDataContainerConverterService } from "./gpx-data-container-converter.service";
import { LoggingService } from "./logging.service";
import { Urls } from "../urls";
import type { DataContainer, MarkerData, RouteData } from "../models/models";

describe("FileService", () => {

    let imageResizeService: ImageResizeService;
    let nonAngularObjectsFactory: NonAngularObjectsFactory;
    let selectedRouteService: SelectedRouteService;
    let fitBoundsService: FitBoundsService;

    beforeEach(() => {
        imageResizeService = {
            resizeImageAndConvert: () => Promise.resolve({
                northEast: { lat: 0, lng: 0 },
                southWest: { lat: 1, lng: 1 },
                routes: [{ markers: [{} as MarkerData] }] as RouteData[]
            } as DataContainer)
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
                LoggingService,
                FileSystemWrapper,
                // eslint-disable-next-line
                FileTransfer,
                SocialSharing,
                GpxDataContainerConverterService,
                { provide: FitBoundsService, useValue: fitBoundsService },
                { provide: SelectedRouteService, useValue: selectedRouteService },
                { provide: NonAngularObjectsFactory, useValue: nonAngularObjectsFactory },
                { provide: ImageResizeService, useValue: imageResizeService },
                FileService
            ]
        });
    });

    it("Should save to file", inject([FileService, HttpTestingController],
        async (fileService: FileService, mockBackend: HttpTestingController) => {

            let promise = fileService.saveToFile("file.name", "format", {} as DataContainer).then(() => {
                expect(nonAngularObjectsFactory.saveAsWrapper).toHaveBeenCalled();
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

            setTimeout(() => {
                mockBackend.expectOne(Urls.openFile).flush({
                    northEast: { lat: 0, lng: 0 },
                    southWest: { lat: 1, lng: 1 },
                    routes: [{
                        markers: [{}],
                    }]
                } as DataContainer);
            }, 1000);

            return promise;
        }));

    it("Should open jpeg file and resize it", inject([FileService, HttpTestingController],
        async (fileService: FileService) => {
            let file = new Blob([""], { type: ImageResizeService.JPEG }) as File;
            await fileService.addRoutesFromFile(file);
            expect(selectedRouteService.addRoutes).toHaveBeenCalled();
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
            target: { dataTransfer: [] as any[] },
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
