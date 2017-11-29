import { TestBed, inject, fakeAsync } from "@angular/core/testing";
import { HttpClientModule, HttpClient } from "@angular/common/http";
import { HttpClientTestingModule, HttpTestingController } from "@angular/common/http/testing";
import * as FileSaverFunctions from "file-saver";

import { FileService, IFormatViewModel } from "./file.service";
import { Urls } from "../common/Urls";
import * as Common from "../common/IsraelHiking";

describe("FileService", () => {

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [
                HttpClientModule,
                HttpClientTestingModule
            ],
            providers: [
                {
                    provide: FileService,
                    useFactory: fakeAsync((http, mockBackend: HttpTestingController) => {
                        let fileService = new FileService(http);
                        mockBackend.expectOne(Urls.fileFormats).flush([{
                            extension: "ex",
                            label: "label",
                            outputFormat: "output"
                        } as IFormatViewModel]);
                        return fileService;
                    }),
                    deps: [HttpClient, HttpTestingController]
                }
            ]
        });
    });

    

    it("Should Initialize with file formats", inject([FileService], (fileService: FileService) => {
        expect(fileService.formats.length).toBe(2);
    }));

    it("Should save to file", inject([FileService, HttpTestingController], async (fileService: FileService, mockBackend: HttpTestingController) => {
        spyOn(FileSaverFunctions, "saveAs");
        

        fileService.saveToFile("file.name", "format", {} as Common.DataContainer).then(() => {
            expect(FileSaverFunctions.saveAs).toHaveBeenCalled();    
        });

        mockBackend.expectOne(Urls.files + "?format=format").flush(btoa("bytes"));
    }));


    it("Should open from file", inject([FileService, HttpTestingController], async (fileService: FileService, mockBackend: HttpTestingController) => {
        spyOn(FileSaverFunctions, "saveAs");

        fileService.openFromUrl("someurl").then(() => { }, fail);

        mockBackend.expectOne(Urls.files + "?url=someurl").flush(btoa("bytes"));
    }));

    it("Should open from url by uploading", inject([FileService, HttpTestingController], async (fileService: FileService, mockBackend: HttpTestingController) => {
        fileService.openFromFile(new Blob([""]) as File).then(() => {}, fail);

        mockBackend.expectOne(Urls.openFile);
    }));
});