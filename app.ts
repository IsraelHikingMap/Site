module IsraelHiking {
    // HM TODO: finish search.
    // HM TODO: support twl? - will be solved hopefull with iis backend.

    export var app = angular.module("IsraelHiking", ["ngFileUpload", "mgcrea.ngStrap", "LocalStorageModule", "n3-line-chart"]);

    L.Icon.Default.imagePath = "content/images/";

    // Services:
    app.service(Common.Constants.mapService, [() => new Services.MapService()]);
    app.service(Common.Constants.parserFactory, [() => new Services.Parsers.ParserFactory()]);
    app.service(Common.Constants.routerFactory, [Common.Constants.http, Common.Constants.q, Common.Constants.parserFactory,
        ($http: angular.IHttpService, $q: angular.IQService, parserFactory: Services.Parsers.ParserFactory) =>
            new Services.Routers.RouterFactory($http, $q, parserFactory)]);
    app.service(Common.Constants.snappingService, [Common.Constants.http, Common.Constants.mapService, Common.Constants.parserFactory,
        ($http: angular.IHttpService, mapService: Services.MapService, parserFactory: Services.Parsers.ParserFactory) =>
            new Services.SnappingService($http, mapService, parserFactory)]);
    app.service(Common.Constants.drawingFactory,
        [Common.Constants.q, Common.Constants.compile, Common.Constants.rootScope, Common.Constants.mapService, Common.Constants.routerFactory, Common.Constants.hashService, Common.Constants.snappingService,
            ($q: angular.IQService, $compile: angular.ICompileService, $rootScope: angular.IRootScopeService, mapService: Services.MapService, routeFactory: Services.Routers.RouterFactory, hashService: Services.HashService, snappingService: Services.SnappingService) =>
                new Services.Drawing.DrawingFactory($q, $compile, $rootScope, mapService, routeFactory, hashService, snappingService)]);

    app.service(Common.Constants.hashService, [Common.Constants.location, Common.Constants.rootScope, Common.Constants.localStorageService,
        ($location: angular.ILocationService, $rootScope: angular.IRootScopeService, localStorageService: angular.local.storage.ILocalStorageService) =>
            new Services.HashService($location, $rootScope, localStorageService)]);
    app.service(Common.Constants.controlCreatorService, [Common.Constants.rootScope, Common.Constants.compile, ($rootScope: angular.IScope, $compile: angular.ICompileService) => new Services.ControlCreatorService($rootScope, $compile)]);
    app.service(Common.Constants.layersService, [Common.Constants.mapService, Common.Constants.localStorageService, Common.Constants.drawingFactory, Common.Constants.hashService,
        (mapService: Services.MapService, localStorageService: angular.local.storage.ILocalStorageService, drawingFactory: Services.Drawing.DrawingFactory, hashService: Services.HashService) =>
            new Services.LayersService(mapService, localStorageService, drawingFactory, hashService)]);

    app.controller(Common.Constants.mainMapController, [Common.Constants.mapService, Common.Constants.controlCreatorService, Common.Constants.hashService,
        (mapService: Services.MapService, controlCreatorService: Services.ControlCreatorService, hashService: Services.HashService) =>
            new Controllers.MainMapcontoller(mapService, controlCreatorService, hashService)]);
    
    // Directives:
    app.directive("markerPopup", () => <angular.IDirective> {
        controller: Controllers.MarkerPopupController,
        templateUrl: "views/templates/markerPopup.tpl.html",
    });
    app.directive("drawingControl", () => <angular.IDirective> {
        controller: Controllers.DrawingController,
        templateUrl: "views/drawing.html",
    });
    app.directive("editOsmControl", () => <angular.IDirective> {
        controller: Controllers.EditOSMController,
        templateUrl: "views/editOSM.html",
    });
    app.directive("fileControl", () => <angular.IDirective> {
        controller: Controllers.FileController,
        templateUrl: "views/file.html",
    });
    app.directive("infoHelpControl", () => <angular.IDirective> {
        controller: Controllers.InfoHelpController,
        templateUrl: "views/infoHelp.html",
    });
    app.directive("layersControl", () => <angular.IDirective> {
        controller: Controllers.LayersController,
        templateUrl: "views/layers.html",
    });
    app.directive("searchControl", () => <angular.IDirective> {
        controller: Controllers.SearchController,
        templateUrl: "views/search.html",
    });
}