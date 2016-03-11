module IsraelHiking {
    export var app = angular.module("IsraelHiking", ["ngFileUpload", "mgcrea.ngStrap", "LocalStorageModule", "googlechart", "ngAnimate", "toastr", "angular-loading-bar"]);

    L.Icon.Default.imagePath = "content/images/";

    // Services:
    app.service(Common.Constants.mapService, [() => new Services.MapService()]);
    app.service(Common.Constants.parserFactory, [() => new Services.Parsers.ParserFactory()]);
    app.service(Common.Constants.microsoftElevationProvider, [Common.Constants.http, Common.Constants.toastr,
        ($http: angular.IHttpService, toastr: Toastr) =>
            new Services.Elevation.MicrosoftElevationProvider($http, toastr)]);
    app.service(Common.Constants.elevationProvider, [Common.Constants.http, Common.Constants.toastr,
        ($http: angular.IHttpService, toastr: Toastr) =>
            new Services.Elevation.ElevationProvider($http, toastr)]);
    app.service(Common.Constants.routerService, [Common.Constants.http, Common.Constants.q, Common.Constants.toastr, Common.Constants.parserFactory,
        ($http: angular.IHttpService, $q: angular.IQService, toastr: Toastr, parserFactory: Services.Parsers.ParserFactory) =>
            new Services.Routers.RouterService($http, $q, toastr, parserFactory)]);
    app.service(Common.Constants.fileService, [Common.Constants.http, Common.Constants.parserFactory, Common.Constants.elevationProvider, Common.Constants.upload,
        ($http: angular.IHttpService, parserFactory: Services.Parsers.ParserFactory, elevationProvider: Services.Elevation.IElevationProvider, Upload: angular.angularFileUpload.IUploadService) =>
            new Services.FileService($http, parserFactory, elevationProvider, Upload)]);
    app.service(Common.Constants.snappingService, [Common.Constants.http, Common.Constants.mapService, Common.Constants.parserFactory, Common.Constants.toastr,
        ($http: angular.IHttpService, mapService: Services.MapService, parserFactory: Services.Parsers.ParserFactory, toastr: Toastr) =>
            new Services.SnappingService($http, mapService, parserFactory, toastr)]);
    app.service(Common.Constants.drawingFactory,
        [Common.Constants.q, Common.Constants.compile, Common.Constants.rootScope, Common.Constants.mapService, Common.Constants.routerService, Common.Constants.hashService, Common.Constants.snappingService, Common.Constants.elevationProvider,
            ($q: angular.IQService, $compile: angular.ICompileService, $rootScope: angular.IRootScopeService, mapService: Services.MapService, routerService: Services.Routers.RouterService, hashService: Services.HashService, snappingService: Services.SnappingService, elevationProvider: Services.Elevation.IElevationProvider) =>
                new Services.Drawing.DrawingFactory($q, $compile, $rootScope, mapService, routerService, hashService, snappingService, elevationProvider)]);
    app.service(Common.Constants.hashService, [Common.Constants.location, Common.Constants.rootScope, Common.Constants.localStorageService,
        ($location: angular.ILocationService, $rootScope: angular.IRootScopeService, localStorageService: angular.local.storage.ILocalStorageService) =>
            new Services.HashService($location, $rootScope, localStorageService)]);
    app.service(Common.Constants.controlCreatorService, [Common.Constants.rootScope, Common.Constants.compile, ($rootScope: angular.IScope, $compile: angular.ICompileService) => new Services.ControlCreatorService($rootScope, $compile)]);
    app.service(Common.Constants.layersService, [Common.Constants.http, Common.Constants.mapService, Common.Constants.localStorageService, Common.Constants.drawingFactory, Common.Constants.hashService,
        ($http: angular.IHttpService, mapService: Services.MapService, localStorageService: angular.local.storage.ILocalStorageService, drawingFactory: Services.Drawing.DrawingFactory, hashService: Services.HashService) =>
            new Services.LayersService($http, mapService, localStorageService, drawingFactory, hashService)]);

    app.controller(Common.Constants.mainMapController, [Common.Constants.mapService, Common.Constants.controlCreatorService, Common.Constants.hashService,
        (mapService: Services.MapService, controlCreatorService: Services.ControlCreatorService, hashService: Services.HashService) =>
            new Controllers.MainMapcontoller(mapService, controlCreatorService, hashService)]);
    
    // Directives:
    app.directive("syncFocusWith", () => new Directives.SyncFocusWithDirective());
    app.directive("draggableMovable", [Common.Constants.window, ($window: angular.IWindowService) => new Directives.DraggableMovableDirective($window)]);
    app.directive("disableMapMovement", [Common.Constants.mapService, (mapService: Services.MapService) => new Directives.DisableMapMovementDirective(mapService)]);
    app.directive("markerPopup", () => <angular.IDirective> {
        controller: Controllers.MarkerPopupController,
        templateUrl: "views/templates/markerPopup.tpl.html"
    });
    app.directive("drawingControl", () => <angular.IDirective> {
        controller: Controllers.DrawingController,
        templateUrl: "views/drawing.html"
    });
    app.directive("editOsmControl", () => <angular.IDirective> {
        controller: Controllers.EditOSMController,
        templateUrl: "views/editOSM.html"
    });
    app.directive("fileControl", () => <angular.IDirective> {
        controller: Controllers.FileController,
        templateUrl: "views/file.html"
    });
    app.directive("infoHelpControl", () => <angular.IDirective> {
        controller: Controllers.InfoHelpController,
        templateUrl: "views/infoHelp.html"
    });
    app.directive("layersControl", () => <angular.IDirective> {
        controller: Controllers.LayersController,
        templateUrl: "views/layers.html"
    });
    app.directive("searchControl", () => <angular.IDirective> {
        controller: Controllers.SearchController,
        templateUrl: "views/search.html"
    });
    app.directive("shareControl", () => <angular.IDirective> {
        controller: Controllers.ShareController,
        templateUrl: "views/share.html"
    });

    app.directive("convertFromatControl", () => <angular.IDirective> {
        controller: Controllers.ConvertFormatController,
        templateUrl: "views/convertFormat.html"
    });

    app.run(["googleChartApiPromise", (googleChartApiPromise) => {
        $("link[type*=icon]").detach().appendTo("head");
    }]);
}