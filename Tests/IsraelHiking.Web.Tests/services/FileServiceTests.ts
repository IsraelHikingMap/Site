/// <reference path="../../../isrealhiking.web/scripts/typings/ng-file-upload/ng-file-upload.d.ts" />
/// <reference path="../../../isrealhiking.web/common/Strings.ts" />
/// <reference path="../../../isrealhiking.web/services/fileservice.ts" />

namespace IsraelHiking.Tests {
    describe("File Service", () => {
        var $http: angular.IHttpService;
        var $httpBackend: angular.IHttpBackendService;
        var upload: angular.angularFileUpload.IUploadService;
        var fileSaver: Services.IFileSaver;
        var fileService: Services.FileService;

        beforeEach(() => {
            angular.mock.module("ngFileUpload");
            angular.mock.module("ngFileSaver");
            angular.mock.inject((_$http_: angular.IHttpService, _$httpBackend_: angular.IHttpBackendService, _Upload_: angular.angularFileUpload.IUploadService, _FileSaver_: Services.IFileSaver) => { // 
                // The injector unwraps the underscores (_) from around the parameter names when matching
                $http = _$http_;
                $httpBackend = _$httpBackend_;
                upload = _Upload_;
                fileSaver = _FileSaver_;
                fileService = new Services.FileService($http, upload, fileSaver);
            });
        });

        it("Should save to file", () => {
            spyOn(fileSaver, "saveAs");
            $httpBackend.whenPOST(Common.Urls.files + "?format=format").respond(btoa("bytes"));

            fileService.saveToFile("file.name", "format", {} as Common.DataContainer);

            $httpBackend.flush();
            expect(fileSaver.saveAs).toHaveBeenCalled();
        });
        
        it("Should open from file", () => {
            spyOn(upload, "upload");

            fileService.openFromFile(new Blob([""]) as File);

            expect(upload.upload).toHaveBeenCalled();
        });

        it("Should open from url", () => {
            $httpBackend.whenGET(Common.Urls.files + "?url=url").respond({ routes:[], markers: [{} as Common.MarkerData] } as Common.DataContainer);

            fileService.openFromUrl("url")
                .success((data) => expect(data.markers.length).toBe(1));

            $httpBackend.flush();
        });
    });
}