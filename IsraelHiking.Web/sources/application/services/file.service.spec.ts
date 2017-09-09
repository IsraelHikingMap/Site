import { HttpModule, Http, Response, ResponseOptions, XHRBackend } from "@angular/http";
import { TestBed, inject, fakeAsync, flushMicrotasks } from "@angular/core/testing";
import { MockBackend, MockConnection } from "@angular/http/testing";
import { NgProgressService } from "ngx-progressbar";
import * as FileSaverFunctions from "file-saver";

import { FileService, IFormatViewModel } from "./file.service";
import { AuthorizationService } from "./authorization.service";
import { Urls } from "../common/Urls";
import * as Common from "../common/IsraelHiking";

describe("FileService", () => {

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [HttpModule],
            providers: [
                { provide: XHRBackend, useClass: MockBackend },
                AuthorizationService,
                {
                    provide: FileService,
                    useFactory: fakeAsync((http, authorizationService: AuthorizationService, mockBackend: MockBackend) => {
                        mockBackend.connections.subscribe((connection: MockConnection) => {
                            if (connection.request.url.indexOf(Urls.fileFormats) === -1) {
                                return;
                            }
                            connection.mockRespond(new Response(new ResponseOptions({
                                body: JSON.stringify([{
                                    extension: "ex",
                                    label: "label",
                                    outputFormat: "output"
                                } as IFormatViewModel])
                            })));
                        });
                        let progressService = {
                            done: () => { },
                            start: () => { }
                        } as NgProgressService;
                        return new FileService(http, authorizationService, progressService);
                    }),
                    deps: [Http, AuthorizationService, XHRBackend]
                }
            ]
        });
    });

    it("Should Initialize with file formats", inject([FileService], (fileService: FileService) => {
        expect(fileService.formats.length).toBe(2);
    }));

    it("Should save to file", inject([FileService, XHRBackend], fakeAsync((fileService: FileService, mockBackend: MockBackend) => {
        spyOn(FileSaverFunctions, "saveAs");
        mockBackend.connections.subscribe((connection: MockConnection) => {
            if (connection.request.url.indexOf(Urls.files + "?format=format") === -1) {
                return;
            }
            connection.mockRespond(new Response(new ResponseOptions({
                body: JSON.stringify(btoa("bytes"))
            })));
        });

        fileService.saveToFile("file.name", "format", {} as Common.DataContainer);

        flushMicrotasks();
        expect(FileSaverFunctions.saveAs).toHaveBeenCalled();
    })));


    it("Should open from file", inject([FileService, XHRBackend], fakeAsync((fileService: FileService, mockBackend: MockBackend) => {
        spyOn(FileSaverFunctions, "saveAs");
        mockBackend.connections.subscribe((connection: MockConnection) => {
            if (connection.request.url.indexOf(Urls.files + "?url=someurl") === -1) {
                return;
            }
            connection.mockRespond(new Response(new ResponseOptions({
                body: JSON.stringify(btoa("bytes"))
            })));
        });
        let wasCalled = false;

        var promise = fileService.openFromUrl("someurl");
        promise.then(() => { wasCalled = true; });
        flushMicrotasks();

        expect(wasCalled).toBeTruthy();
    })));

    it("Should open from url by uploading success", inject([FileService, AuthorizationService], fakeAsync((fileService: FileService, authorizationService: AuthorizationService) => {
        let request = {
            open: () => { },
            send: () => { },
            onreadystatechange: () => { },
            setRequestHeader: () => { },
            readyState: 4,
            status: 200,
            response: JSON.stringify({ routes: [] } as Common.DataContainer)
        };
        spyOn(authorizationService, "createXMLHttpRequest").and.returnValue(request);
        var wasCalled = false;
        fileService.openFromFile(new Blob([""]) as File).then(() => {
            wasCalled = true;
        }, () => {
            fail();
        });

        request.onreadystatechange();
        flushMicrotasks();

        expect(wasCalled).toBeTruthy();
    })));

    it("Should open from url by uploading but fail", inject([FileService, AuthorizationService], fakeAsync((fileService: FileService, authorizationService: AuthorizationService) => {
        let request = {
            open: () => { },
            send: () => { },
            onreadystatechange: () => { },
            setRequestHeader: () => { },
            readyState: 4,
            status: 500
        };
        spyOn(authorizationService, "createXMLHttpRequest").and.returnValue(request);
        var wasCalled = false;
        fileService.openFromFile(new Blob([""]) as File).then(() => {
            fail();
        }, () => {
            wasCalled = true;
        });
        request.onreadystatechange();
        flushMicrotasks();

        expect(wasCalled).toBeTruthy();
    })));

});