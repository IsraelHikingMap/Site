import { TestBed, inject, fakeAsync } from "@angular/core/testing";
import { HttpClientModule, HttpClient } from "@angular/common/http";
import { HttpClientTestingModule, HttpTestingController } from "@angular/common/http/testing";

import { FileService, IFormatViewModel } from "./file.service";
import { NonAngularObjectsFactory } from "./non-angular-objects.factory";
import { ImageResizeService } from "./image-resize.service";
import { Urls } from "../urls";
import { DataContainer } from "../models/models";
import { RunningContextService } from "./running-context.service";

describe("FileService", () => {

    let imageResizeService: ImageResizeService;
    let nonAngularObjectsFactory: NonAngularObjectsFactory;
    beforeEach(() => {
        imageResizeService = {
            resizeImageAndConvert: jasmine.createSpy("resizeImageAndConvert")
        } as any as ImageResizeService;
        nonAngularObjectsFactory = {
            saveAs: jasmine.createSpy("saveAs"),
            b64ToBlob: jasmine.createSpy("b64ToBlob"),
        } as any as NonAngularObjectsFactory;
        TestBed.configureTestingModule({
            imports: [
                HttpClientModule,
                HttpClientTestingModule
            ],
            providers: [
                RunningContextService,
                {
                    provide: FileService,
                    useFactory: fakeAsync((http, mockBackend: HttpTestingController, runningContextService: RunningContextService) => {
                        let fileService = new FileService(http, runningContextService, imageResizeService, nonAngularObjectsFactory);
                        mockBackend.expectOne(Urls.fileFormats).flush([{
                            extension: "ex",
                            label: "label",
                            outputFormat: "output"
                        } as IFormatViewModel]);
                        return fileService;
                    }),
                    deps: [HttpClient, HttpTestingController, RunningContextService]
                }
            ]
        });
    });

    it("Should Initialize with file formats", inject([FileService], (fileService: FileService) => {
        expect(fileService.formats.length).toBe(2);
    }));

    it("Should save to file", inject([FileService, HttpTestingController],
        async (fileService: FileService, mockBackend: HttpTestingController) => {

            let promise = fileService.saveToFile("file.name", "format", {} as DataContainer).then(() => {
                expect(nonAngularObjectsFactory.saveAs).toHaveBeenCalled();
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

            let promise = fileService.openFromFile(new Blob([""]) as File).then((res) => {
                expect(res).not.toBeNull();
            }, fail);

            mockBackend.expectOne(Urls.openFile).flush({});
            return promise;
        }));

    it("Should open jpeg file and resize it", inject([FileService, HttpTestingController],
        async (fileService: FileService) => {
            let file = new Blob([""], { type: "image/jpeg" }) as File;
            let promise = fileService.openFromFile(file).then(() => {
                expect(imageResizeService.resizeImageAndConvert).toHaveBeenCalled();
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