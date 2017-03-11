/// <reference path="../../../israelhiking.web/services/ResourcesService.ts" />

namespace IsraelHiking.Tests.Services {
    describe("Resources Service", () => {
        var resourcesSerivice: IsraelHiking.Services.ResourcesService;
        var $httpBackend: angular.IHttpBackendService;
        var $sce: angular.ISCEService
        var localStorageService: angular.local.storage.ILocalStorageService;
        var gettextCatalog: angular.gettext.gettextCatalog;

        beforeEach(() => {
            angular.mock.module("LocalStorageModule");
            angular.mock.module("gettext");
            angular.mock.inject((_$http_: angular.IHttpService, _$httpBackend_: angular.IHttpBackendService, _$sce_: angular.ISCEService, _localStorageService_: angular.local.storage.ILocalStorageService, _gettextCatalog_: angular.gettext.gettextCatalog) => { // 
                // The injector unwraps the underscores (_) from around the parameter names when matching
                $sce = _$sce_;
                gettextCatalog = _gettextCatalog_;
                $httpBackend = _$httpBackend_;
                localStorageService = _localStorageService_;

                localStorageService.get = () => null;
                $httpBackend.whenGET(url => url.indexOf(Common.Urls.translations) !== -1).respond(200, {});
                
                resourcesSerivice = new IsraelHiking.Services.ResourcesService($sce, localStorageService, gettextCatalog);
            });
        });

        it("Should initialize from local storage with english", () => {
            localStorageService.get = () => resourcesSerivice.availableLanguages[1];

            resourcesSerivice = new IsraelHiking.Services.ResourcesService($sce, localStorageService, gettextCatalog);

            expect(resourcesSerivice.currentLanguage.code).toBe(resourcesSerivice.availableLanguages[1].code);
            expect(resourcesSerivice.route).toBe("Route");
        });

        it("Should initialize from local storage with hebrew", () => {
            localStorageService.get = () => resourcesSerivice.availableLanguages[0];

            resourcesSerivice = new IsraelHiking.Services.ResourcesService($sce, localStorageService, gettextCatalog);

            expect(resourcesSerivice.currentLanguage.code).toBe(resourcesSerivice.availableLanguages[0].code);
            expect(resourcesSerivice.route).toBe("מסלול");
        });

        it("Should faciliate language change to english", (done) => {
            resourcesSerivice.setLanguage(resourcesSerivice.availableLanguages[1]).then(() => {
                expect(resourcesSerivice.currentLanguage.code).toBe(resourcesSerivice.availableLanguages[1].code);    
            }).finally(done);
            $httpBackend.flush();
        });

        it("Should faciliate language change to hebrew", (done) => {
            resourcesSerivice.setLanguage(resourcesSerivice.availableLanguages[0]).then(() => {
                expect(resourcesSerivice.currentLanguage.code).toBe(resourcesSerivice.availableLanguages[0].code);
            }).finally(done);
            $httpBackend.flush();

            
        });
    });
}