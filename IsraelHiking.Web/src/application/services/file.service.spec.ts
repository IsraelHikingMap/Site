import { TestBed, inject } from "@angular/core/testing";
import { HttpEventType, provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { File as FileSystemWrapper } from "@awesome-cordova-plugins/file/ngx";
import { FileTransfer } from "@awesome-cordova-plugins/file-transfer/ngx";
import { StyleSpecification } from "maplibre-gl";
import { strToU8, zipSync, unzipSync, strFromU8 } from "fflate";

import { FileService, SaveAsFactory } from "./file.service";
import { ImageResizeService } from "./image-resize.service";
import { RunningContextService } from "./running-context.service";
import { SelectedRouteService } from "./selected-route.service";
import { FitBoundsService } from "./fit-bounds.service";
import { GpxDataContainerConverterService } from "./gpx-data-container-converter.service";
import { LoggingService } from "./logging.service";
import { ConnectionService } from "./connection.service";
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
            providers: [
                RunningContextService,
                FileTransfer,
                GpxDataContainerConverterService,
                { provide: ConnectionService, useValue: { stateChanged: { subscribe: () => {} }} },
                { provide: FileSystemWrapper, useValue: {
                    writeFile: () => Promise.resolve()
                } },
                { provide: LoggingService, useValue: loggingServiceMock },
                { provide: FitBoundsService, useValue: fitBoundsService },
                { provide: SelectedRouteService, useValue: selectedRouteService },
                { provide: ImageResizeService, useValue: imageResizeService },
                { provide: SaveAsFactory, useFactory: () => saveAsSpy },
                FileService,
                provideHttpClient(withInterceptorsFromDi()),
                provideHttpClientTesting()
            ]
        });
    });

    it("Should save to file on web", inject([FileService, HttpTestingController],
        async (service: FileService, mockBackend: HttpTestingController) => {

            const promise = service.saveToFile("file.name", "format", {} as DataContainer).then(() => {
                expect(saveAsSpy).toHaveBeenCalled();
            });

            mockBackend.expectOne(Urls.files + "?format=format").flush(btoa("bytes"));
            return promise;
    }));

    it("Should save to file on mobile", inject([FileService, RunningContextService, FileSystemWrapper],
        async (service: FileService, runningContextService: RunningContextService, fileSystemWrapper: FileSystemWrapper) => {
            fileSystemWrapper.resolveLocalFilesystemUrl = jasmine.createSpy().and.returnValue(Promise.resolve({
                nativeURL: "file:///some-file",
            }));
            (runningContextService as any).isCapacitor = true;
            const dataContainer = { 
                routes: [{
                    markers: [{latlng: { lat: 1, lng: 2}, urls: []}],
                    segments: []
                }], 
            } as DataContainer;

            await service.saveToFile("file.gpx", "gpx", dataContainer);

            expect(fileSystemWrapper.resolveLocalFilesystemUrl).toHaveBeenCalled();
    }));

    it("Should add routes from url", inject([FileService, HttpTestingController],
        async (service: FileService, mockBackend: HttpTestingController) => {

            const promise = service.addRoutesFromUrl("someurl").then(() => {
                expect(selectedRouteService.addRoutes).toHaveBeenCalled();
            }, fail);

            mockBackend.expectOne(Urls.files + "?url=someurl").flush({
                northEast: { lat: 1, lng: 1}, southWest: { lat: 2, lng: 2}
            });
            return promise;
        }));

    it("Should open from url by uploading", inject([FileService, HttpTestingController],
        async (service: FileService, mockBackend: HttpTestingController) => {

            const promise = service.addRoutesFromFile(new Blob([""]) as File).then(() => {
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
        async (service: FileService) => {
            const file = new Blob([""], { type: ImageResizeService.JPEG }) as File;
            await service.addRoutesFromFile(file);
            expect(selectedRouteService.addRoutes).toHaveBeenCalled();
        }));

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

    it("Should get style json content from local when offline", inject([FileService, FileSystemWrapper], async (service: FileService, fileSystemWrapper: FileSystemWrapper) => {
        const spy = jasmine.createSpy();
        fileSystemWrapper.readAsText = spy.and.returnValue(Promise.resolve("{}"));

        const promise = service.getStyleJsonContent("./style.json", true);

        const response = await promise;
        expect(spy).toHaveBeenCalled();
        expect(response).toEqual({} as StyleSpecification);
    }));

    it("Should get empty style json on failure", inject([FileService, FileSystemWrapper], 
        async (service: FileService, fileSystemWrapper: FileSystemWrapper) => {
        const spy = jasmine.createSpy();
        fileSystemWrapper.readAsText = spy.and.returnValue(Promise.resolve({}));

        const promise = service.getStyleJsonContent("./style.json", true);

        const response = await promise;
        expect(spy).toHaveBeenCalled();
        expect(response.layers.length).toBe(0);
        expect(response.sources).toEqual({});
    }));

    it("Should save log to zip file", inject([FileService], async (service: FileService) => {
        await service.saveLogToZipFile("something.zip", "some text");
        
        expect(saveAsSpy).toHaveBeenCalled();
    }));

    it("Should get gpx file from URL", inject([FileService, FileSystemWrapper], 
        async (service: FileService, fileSystemWrapper: FileSystemWrapper) => {
        fileSystemWrapper.resolveLocalFilesystemUrl = jasmine.createSpy().and.returnValue(Promise.resolve({
            file: (cb: any) => { cb(new Blob([]))},
            name: "file.gpx"
        }))

        const file = await service.getFileFromUrl("some-file.gpx");
        
        expect(file.name).toBe("file.gpx");
        expect(file.type).toBe("application/gpx+xml");
    }));

    it("Should get kml file from URL", inject([FileService, FileSystemWrapper], 
        async (service: FileService, fileSystemWrapper: FileSystemWrapper) => {
        fileSystemWrapper.resolveLocalFilesystemUrl = jasmine.createSpy().and.returnValue(Promise.resolve({
            file: (cb: any) => { cb(new Blob([]))},
            name: "file.kml"
        }))

        const file = await service.getFileFromUrl("some-file.kml");
        
        expect(file.name).toBe("file.kml");
        expect(file.type).toBe("application/kml+xml");
    }));

    it("Should get jpg file from URL", inject([FileService, FileSystemWrapper], 
        async (service: FileService, fileSystemWrapper: FileSystemWrapper) => {
        fileSystemWrapper.resolveLocalFilesystemUrl = jasmine.createSpy().and.returnValue(Promise.resolve({
            file: (cb: any) => { cb(new Blob([]))},
            name: "file.jpg"
        }))

        const file = await service.getFileFromUrl("some-file.jpg");
        
        expect(file.name).toBe("file.jpg");
        expect(file.type).toBe("image/jpeg");
    }));

    it("Should get file extention type from URL", inject([FileService, FileSystemWrapper], 
        async (service: FileService, fileSystemWrapper: FileSystemWrapper) => {
        fileSystemWrapper.resolveLocalFilesystemUrl = jasmine.createSpy().and.returnValue(Promise.resolve({
            file: (cb: any) => { cb(new Blob([]))},
            name: "file.something"
        }))

        const file = await service.getFileFromUrl("some-file.something");
        
        expect(file.name).toBe("file.something");
        expect(file.type).toBe("application/something");
    }));

    it("Should get file extention from URL", inject([FileService, FileSystemWrapper], 
        async (service: FileService, fileSystemWrapper: FileSystemWrapper) => {
        fileSystemWrapper.resolveLocalFilesystemUrl = jasmine.createSpy().and.returnValue(Promise.resolve({
            file: (cb: any) => { cb(new Blob([]))},
            name: "file"
        }))

        let file = await service.getFileFromUrl("some-file.gpx");
        expect(file.name).toBe("file.gpx");
        file = await service.getFileFromUrl("some-file.kml");
        expect(file.name).toBe("file.kml");
        file = await service.getFileFromUrl("some-file.jpeg");
        expect(file.name).toBe("file.jpg");
        file = await service.getFileFromUrl("some-file.something");
        expect(file.name).toBe("file.something");
    }));

    it("Should write styles that are sent in a zip", inject([FileService, FileSystemWrapper], 
        async (service: FileService, fileSystemWrapper: FileSystemWrapper) => {
        const spy = jasmine.createSpy();
        fileSystemWrapper.writeFile = spy;

        const result = zipSync({
            "styles/style.json": strToU8(JSON.stringify({}))
        });
        await service.writeStyles(new Blob([result]));
        
        expect(spy).toHaveBeenCalled();
    }));

    it("Should compress text to zip and return uri", inject([FileService, FileSystemWrapper], 
        async (service: FileService, fileSystemWrapper: FileSystemWrapper) => {
            const spy = jasmine.createSpy();
            fileSystemWrapper.writeFile = spy;
            fileSystemWrapper.resolveLocalFilesystemUrl = jasmine.createSpy().and.returnValue(Promise.resolve({
                nativeURL: "file:///some-file",
            }));
            const contents = [{ name: "log.txt", text: "some text" }];
            const fileUri = await service.compressTextToLogZip(contents);
            
            expect(spy).toHaveBeenCalled();
            expect(fileUri).toBe("/some-file");
            const files = unzipSync(new Uint8Array(spy.calls.first().args[2]));
            expect(Object.keys(files)).toEqual([contents[0].name]);
            expect(strFromU8(files[contents[0].name])).toEqual(contents[0].text);
    }));

    it("Should store file to cache", inject([FileService, FileSystemWrapper], 
        async (service: FileService, fileSystemWrapper: FileSystemWrapper) => {
        const spy = jasmine.createSpy();
        fileSystemWrapper.writeFile = spy;

        await service.storeFileToCache("file.txt", "content");

        expect(spy).toHaveBeenCalled();
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

    it("Should download a file to cache", inject([FileService, FileTransfer], 
        async (service: FileService, fileTransfer: FileTransfer) => {
        const spy = jasmine.createSpy();
        const fileTransferObject = { 
            download: jasmine.createSpy(),
            onProgress: () => {}
        };
        fileTransfer.create = spy.and.returnValue(fileTransferObject);
        const url = "http://123.mbtiles";
        const promise = service.downloadFileToCache(url, spy);

        expect(fileTransferObject.download).toHaveBeenCalled();
        return promise;
    }));

    it("Should get file from cache", inject([FileService, FileSystemWrapper], 
        async (service: FileService, fileSystemWrapper: FileSystemWrapper) => {
        const spy = jasmine.createSpy();
        fileSystemWrapper.readAsArrayBuffer = spy;
        const promise = service.getFileFromCache("file");

        expect(spy).toHaveBeenCalled();
        return promise;
    }));

    it("Should delete file from cache", inject([FileService, FileSystemWrapper], 
        async (service: FileService, fileSystemWrapper: FileSystemWrapper) => {
        const spy = jasmine.createSpy();
        fileSystemWrapper.removeFile = spy;
        const promise = service.deleteFileFromCache("file");

        expect(spy).toHaveBeenCalled();
        return promise;
    }));
});
