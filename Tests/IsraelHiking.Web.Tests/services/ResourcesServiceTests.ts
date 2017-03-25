/// <reference path="../../../israelhiking.web/wwwroot/services/ResourcesService.ts" />

namespace IsraelHiking.Tests.Services {
    describe("Resources Service", () => {
        var resourcesService: IsraelHiking.Services.ResourcesService;
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
                
                resourcesService = new IsraelHiking.Services.ResourcesService($sce, localStorageService, gettextCatalog);
            });
        });

        it("Should initialize from local storage with english", () => {
            localStorageService.get = () => resourcesService.availableLanguages[1];

            resourcesService = new IsraelHiking.Services.ResourcesService($sce, localStorageService, gettextCatalog);

            expect(resourcesService.currentLanguage.code).toBe(resourcesService.availableLanguages[1].code);
            expect(resourcesService.route).toBe("Route");
        });

        it("Should initialize from local storage with hebrew", () => {
            localStorageService.get = () => resourcesService.availableLanguages[0];

            resourcesService = new IsraelHiking.Services.ResourcesService($sce, localStorageService, gettextCatalog);

            expect(resourcesService.currentLanguage.code).toBe(resourcesService.availableLanguages[0].code);
            expect(resourcesService.route).toBe("מסלול");
        });

        it("Should faciliate language change to english", (done) => {
            resourcesService.setLanguage(resourcesService.availableLanguages[1]).then(() => {
                expect(resourcesService.currentLanguage.code).toBe(resourcesService.availableLanguages[1].code);    
            }).finally(done);
            $httpBackend.flush();
        });

        it("Should faciliate language change to hebrew", (done) => {
            resourcesService.setLanguage(resourcesService.availableLanguages[0]).then(() => {
                expect(resourcesService.currentLanguage.code).toBe(resourcesService.availableLanguages[0].code);
            }).finally(done);
            $httpBackend.flush();

            
        });
    });
}