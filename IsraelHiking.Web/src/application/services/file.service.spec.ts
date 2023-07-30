import { TestBed, inject } from "@angular/core/testing";
import { HttpClientModule } from "@angular/common/http";
import { HttpClientTestingModule, HttpTestingController } from "@angular/common/http/testing";
import { File as FileSystemWrapper } from "@awesome-cordova-plugins/file/ngx";
import { FileTransfer } from "@awesome-cordova-plugins/file-transfer/ngx";
import { SocialSharing } from "@awesome-cordova-plugins/social-sharing/ngx";
import { StyleSpecification } from "maplibre-gl";
import JSZip from "jszip";

import { FileService, SaveAsFactory } from "./file.service";
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
            imports: [
                HttpClientModule,
                HttpClientTestingModule
            ],
            providers: [
                RunningContextService,
                FileSystemWrapper,
                // eslint-disable-next-line
                FileTransfer,
                SocialSharing,
                GpxDataContainerConverterService,
                { provide: LoggingService, useValue: loggingServiceMock },
                { provide: FitBoundsService, useValue: fitBoundsService },
                { provide: SelectedRouteService, useValue: selectedRouteService },
                { provide: ImageResizeService, useValue: imageResizeService },
                { provide: SaveAsFactory, useFactory: () => saveAsSpy },
                FileService
            ]
        });
    });

    it("Should save to file", inject([FileService, HttpTestingController],
        async (fileService: FileService, mockBackend: HttpTestingController) => {

            const promise = fileService.saveToFile("file.name", "format", {} as DataContainer).then(() => {
                expect(saveAsSpy).toHaveBeenCalled();
            });

            mockBackend.expectOne(Urls.files + "?format=format").flush(btoa("bytes"));
            return promise;
        }));

    it("Should open from file", inject([FileService, HttpTestingController],
        async (fileService: FileService, mockBackend: HttpTestingController) => {

            const promise = fileService.openFromUrl("someurl").then((res) => {
                expect(res).not.toBeNull();
            }, fail);

            mockBackend.expectOne(Urls.files + "?url=someurl").flush(btoa("bytes"));
            return promise;
        }));

    it("Should open from url by uploading", inject([FileService, HttpTestingController],
        async (fileService: FileService, mockBackend: HttpTestingController) => {

            const promise = fileService.addRoutesFromFile(new Blob([""]) as File).then(() => {
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
            const file = new Blob([""], { type: ImageResizeService.JPEG }) as File;
            await fileService.addRoutesFromFile(file);
            expect(selectedRouteService.addRoutes).toHaveBeenCalled();
        }));

    it("Should not get a file from event when there's no files", inject([FileService], (fileService: FileService) => {
        const file = fileService.getFileFromEvent({ target: { files: [] } });

        expect(file).toBe(null);
    }));

    it("Should get a file from event and clear input", inject([FileService], (fileService: FileService) => {
        const event = {
            target: { files: [{}], value: "123" },
        };
        const file = fileService.getFileFromEvent(event);

        expect(file).not.toBe(null);
        expect(event.target.value).toBe("");
    }));

    it("Should not get a files from event", inject([FileService], (fileService: FileService) => {
        const event = {
            target: { dataTransfer: [] as any[] },
        };
        const files = fileService.getFilesFromEvent(event);

        expect(files.length).toBe(0);
    }));

    it("Should get a files from event and clear input", inject([FileService], (fileService: FileService) => {
        const event = {
            target: { files: [{}], value: "123" },
        };
        const files = fileService.getFilesFromEvent(event);

        expect(files.length).toBe(1);
        expect(event.target.value).toBe("");
    }));

    it("Should get full URL", inject([FileService], (fileService: FileService) => {
        const url = fileService.getFullUrl("123");

        expect(url).toContain("/123");
    }));

    it("Should get style json content from remote source", inject([FileService, HttpTestingController], 
        async (fileService: FileService, mockBackend: HttpTestingController) => {
        const promise = fileService.getStyleJsonContent("s.json", false);

        mockBackend.expectOne("s.json").flush({});

        const response = await promise;
        expect(response).toEqual({} as StyleSpecification);
    }));

    it("Should get style json content from local when offline", inject([FileService, FileSystemWrapper], async (fileService: FileService, fileSystemWrapper: FileSystemWrapper) => {
        const spy = jasmine.createSpy();
        fileSystemWrapper.readAsText = spy.and.returnValue(Promise.resolve("{}"));

        const promise = fileService.getStyleJsonContent("./style.json", true);

        const response = await promise;
        expect(spy).toHaveBeenCalled();
        expect(response).toEqual({} as StyleSpecification);
    }));

    it("Should get empty style json on failure", inject([FileService, FileSystemWrapper], 
        async (fileService: FileService, fileSystemWrapper: FileSystemWrapper) => {
        const spy = jasmine.createSpy();
        fileSystemWrapper.readAsText = spy.and.returnValue(Promise.resolve({}));

        const promise = fileService.getStyleJsonContent("./style.json", true);

        const response = await promise;
        expect(spy).toHaveBeenCalled();
        expect(response.layers.length).toBe(0);
        expect(response.sources).toEqual({});
    }));

    it("Should save log to zip file", inject([FileService], async (fileService: FileService) => {
        await fileService.saveLogToZipFile("something.zip", "some text");
        
        expect(saveAsSpy).toHaveBeenCalled();
    }));

    it("Should get gpx file from URL", inject([FileService, FileSystemWrapper], 
        async (fileService: FileService, fileSystemWrapper: FileSystemWrapper) => {
        const spy = jasmine.createSpy();
        fileSystemWrapper.resolveLocalFilesystemUrl = spy.and.returnValue(Promise.resolve({
            file: (cb: any) => { cb(new Blob([]))},
            name: "file.gpx"
        }))

        const file = await fileService.getFileFromUrl("some-file.gpx");
        
        expect(file.name).toBe("file.gpx");
        expect(file.type).toBe("application/gpx+xml");
    }));

    it("Should get kml file from URL", inject([FileService, FileSystemWrapper], 
        async (fileService: FileService, fileSystemWrapper: FileSystemWrapper) => {
        const spy = jasmine.createSpy();
        fileSystemWrapper.resolveLocalFilesystemUrl = spy.and.returnValue(Promise.resolve({
            file: (cb: any) => { cb(new Blob([]))},
            name: "file.kml"
        }))

        const file = await fileService.getFileFromUrl("some-file.kml");
        
        expect(file.name).toBe("file.kml");
        expect(file.type).toBe("application/kml+xml");
    }));

    it("Should get jpg file from URL", inject([FileService, FileSystemWrapper], 
        async (fileService: FileService, fileSystemWrapper: FileSystemWrapper) => {
        const spy = jasmine.createSpy();
        fileSystemWrapper.resolveLocalFilesystemUrl = spy.and.returnValue(Promise.resolve({
            file: (cb: any) => { cb(new Blob([]))},
            name: "file.jpg"
        }))

        const file = await fileService.getFileFromUrl("some-file.jpg");
        
        expect(file.name).toBe("file.jpg");
        expect(file.type).toBe("image/jpeg");
    }));

    it("Should get file extention type from URL", inject([FileService, FileSystemWrapper], 
        async (fileService: FileService, fileSystemWrapper: FileSystemWrapper) => {
        const spy = jasmine.createSpy();
        fileSystemWrapper.resolveLocalFilesystemUrl = spy.and.returnValue(Promise.resolve({
            file: (cb: any) => { cb(new Blob([]))},
            name: "file.something"
        }))

        const file = await fileService.getFileFromUrl("some-file.something");
        
        expect(file.name).toBe("file.something");
        expect(file.type).toBe("application/something");
    }));

    it("Should write styles that are sent in a zip", inject([FileService, FileSystemWrapper], 
        async (fileService: FileService, fileSystemWrapper: FileSystemWrapper) => {
        const spy = jasmine.createSpy();
        fileSystemWrapper.writeFile = spy;

        const zip = new JSZip();
        zip.folder("styles");
        zip.file("styles/style.json", JSON.stringify({}));
        const zipOutput = await zip.generateAsync({type: "blob"});

        await fileService.writeStyles(zipOutput);
        
        expect(spy).toHaveBeenCalled();
    }));

    it("Should compress text to base 64 zip", inject([FileService], 
        async (fileService: FileService) => {

        expect(async () => await fileService.compressTextToBase64Zip([{ name: "log.txt.", text: "some text" }])).not.toThrow();
    }));
});
