module IsraelHiking {
    // HM TODO: open file point in the end missing.
    // HM TODO: routing icons and no routing for markers.
    // HM TODO: update route from file with the same name?
    // HM TODO: better middle marker support.
    // HM TODO: update help, better contrast.
    // HM TODO: confirm on delete.
    // HM TODO: hide file download tool tip after click;
    // HM TODO: add waiting animation when routing works (Not sure I'll bother doing it in the end)
    // HM TODO: url to route (address/?url=)
    // HM TODO: support twl? - will be solved hopefull with iis backend.
    // HM TODO: remove hiking trails layer on map change? - not sure it is currently possible another leaflet bug.
    // HM TODO: when hovering on routePoint/marker - allow the user to move the editing related on.
    // HM TODO: height graph?

    export var app = angular.module("IsraelHiking", ["ngFileUpload", "mgcrea.ngStrap", "LocalStorageModule"]);

    L.Icon.Default.imagePath = "content/images/";

    // Services:
    app.service(Common.Constants.mapService, [() => new Services.MapService()]);
    app.service(Common.Constants.parserFactory, [() => new Services.Parsers.ParserFactory()]);
    app.service(Common.Constants.routerFactory, [Common.Constants.http, Common.Constants.q, Common.Constants.parserFactory,
        ($http: angular.IHttpService, $q: angular.IQService, parserFactory: Services.Parsers.ParserFactory) =>
            new Services.Routers.RouterFactory($http, $q, parserFactory)]);
    app.service(Common.Constants.drawingFactory,
        [Common.Constants.q, Common.Constants.compile, Common.Constants.rootScope, Common.Constants.mapService, Common.Constants.routerFactory, Common.Constants.hashService,
            ($q: angular.IQService, $compile: angular.ICompileService, $rootScope: angular.IRootScopeService, mapService: Services.MapService, routeFactory: Services.Routers.RouterFactory, hashService: Services.HashService) =>
                new Services.Drawing.DrawingFactory($q, $compile, $rootScope, mapService, routeFactory, hashService)]);
    app.service(Common.Constants.hashService, [Common.Constants.location, Common.Constants.rootScope,
        ($location: angular.ILocationService, $rootScope: angular.IRootScopeService) =>
            new Services.HashService($location, $rootScope)]);
    app.service(Common.Constants.controlCreatorService, [Common.Constants.rootScope, Common.Constants.compile, ($rootScope: angular.IScope, $compile: angular.ICompileService) => new Services.ControlCreatorService($rootScope, $compile)]);
    app.service(Common.Constants.layersService, [Common.Constants.mapService, Common.Constants.localStorageService, Common.Constants.drawingFactory, Common.Constants.hashService,
        (mapService: Services.MapService, localStorageService: angular.local.storage.ILocalStorageService, drawingFactory: Services.Drawing.DrawingFactory, hashService: Services.HashService) => 
        new Services.LayersService(mapService, localStorageService, drawingFactory, hashService)]);
    
    app.controller(Common.Constants.mainMapController, [Common.Constants.mapService, Common.Constants.controlCreatorService, Common.Constants.hashService,
        (mapService: Services.MapService, controlCreatorService: Services.ControlCreatorService, hashService: Services.HashService) =>
            new Controllers.MainMapcontoller(mapService, controlCreatorService, hashService)]);
    
    // Directives:
    app.directive("markerPopup",() => <angular.IDirective> {
        controller: Controllers.MarkerPopupController,
        templateUrl: "views/templates/markerPopup.tpl.html",
    });
    app.directive("drawingControl",() => <angular.IDirective> {
        controller: Controllers.DrawingController,
        templateUrl: "views/drawing.html",
    });
    app.directive("editOsmControl",() => <angular.IDirective> {
        controller: Controllers.EditOSMController,
        templateUrl: "views/editOSM.html",
    });
    app.directive("fileControl",() => <angular.IDirective> {
        controller: Controllers.FileController,
        templateUrl: "views/file.html",
    });
    app.directive("infoHelpControl",() => <angular.IDirective> {
        controller: Controllers.InfoHelpController,
        templateUrl: "views/infoHelp.html",
    });
    app.directive("layersControl",() => <angular.IDirective> {
        controller: Controllers.LayersController,
        templateUrl: "views/layers.html",
    });    
}