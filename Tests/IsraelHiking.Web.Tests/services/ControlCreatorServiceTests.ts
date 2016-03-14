/// <reference path="../../../isrealhiking.web/common/constants.ts" />
/// <reference path="../../../isrealhiking.web/services/controlcreatorservice.ts" />


module IsraelHiking.Tests {
    describe("Control Creator", () => {
        var $rootScope: angular.IRootScopeService;
        var $compile: angular.ICompileService;
        var mapService: Services.MapService;
        var contorlCreator: Services.ControlCreatorService;
        var mapDiv: JQuery;

        beforeEach(() => {
            angular.mock.module("ngFileUpload");
            angular.mock.module("ngFileSaver");
            angular.mock.inject((_$rootScope_: angular.IRootScopeService, _$compile_: angular.ICompileService, _$document_: angular.IDocumentService) => { // 
                // The injector unwraps the underscores (_) from around the parameter names when matching
                $rootScope = _$rootScope_;
                $compile = _$compile_;
                mapDiv = angular.element("<div>");
                mapDiv.attr("id", "map");
                _$document_.find("body").eq(0).append(mapDiv);
                mapService = new Services.MapService();
                contorlCreator = new Services.ControlCreatorService($rootScope, $compile, mapService);
            });
        });

        afterEach(() => {
            mapDiv.remove();
            mapDiv = null;
        });

        it("Should create a control from directive", () => {
            contorlCreator.create("directive", "topright");

            expect(mapDiv.find("directive").length).toBe(1);
        });
    });
}