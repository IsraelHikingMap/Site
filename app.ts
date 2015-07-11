module IsraelHiking {
    // HM TODO: reduce marker size.
    // HM TODO: better middle marker support.
    // HM TODO: middle markers when opening file.
    // HM TODO: add waiting animation when routing works (Not sure I'll bother doing it in the end)
    // HM TODO: url to route (address/?url=)
    // HM TODO: support multiple files and routes - also in layer switcher.
    // HM TODO: support twl? - will be solved hopefull with iis backend.
    // HM TODO: remove hiking trails layer on map change? - not sure it is currently possible another leaflet bug.
    // HM TODO: when hovering on routePoint/marker - allow the user to move the editing related on.
    // HM TODO: bug: firefox, there is also an issue with "sharing".
    // HM TODO: height graph?

    export var app = angular.module("IsraelHiking", ["ngFileUpload", "mgcrea.ngStrap"]);

    L.Icon.Default.imagePath = "content/images/";

    // Services:
    app.service(Common.Constants.mapService, [() => new Services.MapService()]);
    app.service(Common.Constants.parserFactory, [() => new Services.Parsers.ParserFactory()]);
    app.service(Common.Constants.routerFactory, [Common.Constants.http, Common.Constants.q, Common.Constants.parserFactory,
        ($http: angular.IHttpService, $q: angular.IQService, parserFactory: Services.Parsers.ParserFactory) =>
            new Services.Routers.RouterFactory($http, $q, parserFactory)]);
    app.service(Common.Constants.drawingRouteService, [Common.Constants.q, Common.Constants.mapService, Common.Constants.routerFactory,
        ($q: angular.IQService, mapService: Services.MapService, routerFactory: Services.Routers.RouterFactory) =>
            new Services.DrawingRouteService($q, mapService, routerFactory)]);
    app.service(Common.Constants.drawingMarkerService, [Common.Constants.compile, Common.Constants.rootScope, Common.Constants.mapService,
        ($compile: angular.ICompileService, $rootScope: angular.IRootScopeService, mapService: Services.MapService) =>
            new Services.DrawingMarkerService($compile, $rootScope, mapService)]);
    app.service(Common.Constants.hashService, [Common.Constants.location, Common.Constants.rootScope, Common.Constants.mapService, Common.Constants.drawingRouteService, Common.Constants.drawingMarkerService,
        ($location: angular.ILocationService, $rootScope: angular.IRootScopeService, mapService: Services.MapService, drawingRouteService: Services.DrawingRouteService, drawingMarkerService: Services.DrawingMarkerService) =>
            new Services.HashService($location, $rootScope, mapService, drawingRouteService, drawingMarkerService)]);
    app.service(Common.Constants.controlCreatorService, [Common.Constants.rootScope, Common.Constants.compile, ($rootScope: angular.IScope, $compile: angular.ICompileService) => new Services.ControlCreatorService($rootScope, $compile)]);

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
}