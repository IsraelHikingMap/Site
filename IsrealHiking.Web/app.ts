namespace IsraelHiking {
    export var app = angular.module("IsraelHiking", ["ngFileUpload", "mgcrea.ngStrap",
        "LocalStorageModule", "googlechart", "ngAnimate",
        "toastr", "angular-loading-bar", "ngFileSaver"]);

    L.Icon.Default.imagePath = "content/images/";

    // Services:
    app.service(Common.Constants.mapService, [() => new Services.MapService()]);
    app.service(Common.Constants.parserFactory, [() => new Services.Parsers.ParserFactory()]);
    app.service(Common.Constants.sidebarService, [() => new Services.SidebarService()]);
    app.service(Common.Constants.searchResultsProviderFactory, [Common.Constants.http, Common.Constants.q,
        ($http: angular.IHttpService, $q: angular.IQService) =>
            new Services.Search.SearchResultsProviderFactory($http, $q)]);
    app.service(Common.Constants.microsoftElevationProvider, [Common.Constants.http, Common.Constants.toastr,
        ($http: angular.IHttpService, toastr: Toastr) =>
            new Services.Elevation.MicrosoftElevationProvider($http, toastr)]);
    app.service(Common.Constants.elevationProvider, [Common.Constants.http, Common.Constants.toastr,
        ($http: angular.IHttpService, toastr: Toastr) =>
            new Services.Elevation.ElevationProvider($http, toastr)]);
    app.service(Common.Constants.routerService, [Common.Constants.http, Common.Constants.q, Common.Constants.toastr, Common.Constants.parserFactory,
        ($http: angular.IHttpService, $q: angular.IQService, toastr: Toastr, parserFactory: Services.Parsers.ParserFactory) =>
            new Services.Routers.RouterService($http, $q, toastr, parserFactory)]);
    app.service(Common.Constants.fileService, [Common.Constants.http, Common.Constants.upload, Common.Constants.fileSaver,
        ($http: angular.IHttpService, upload: angular.angularFileUpload.IUploadService, fileSaver: Services.IFileSaver) =>
            new Services.FileService($http, upload, fileSaver)]);
    app.service(Common.Constants.snappingService, [Common.Constants.http, Common.Constants.mapService, Common.Constants.parserFactory, Common.Constants.toastr,
        ($http: angular.IHttpService, mapService: Services.MapService, parserFactory: Services.Parsers.ParserFactory, toastr: Toastr) =>
            new Services.SnappingService($http, mapService, parserFactory, toastr)]);
    app.service(Common.Constants.drawingFactory,
        [Common.Constants.q, Common.Constants.compile, Common.Constants.rootScope, Common.Constants.localStorageService, Common.Constants.mapService, Common.Constants.routerService, Common.Constants.hashService, Common.Constants.snappingService, Common.Constants.elevationProvider,
            ($q: angular.IQService, $compile: angular.ICompileService, $rootScope: angular.IRootScopeService, localStorageService:angular.local.storage.ILocalStorageService, mapService: Services.MapService, routerService: Services.Routers.RouterService, hashService: Services.HashService, snappingService: Services.SnappingService, elevationProvider: Services.Elevation.IElevationProvider) =>
                new Services.Drawing.DrawingFactory($q, $compile, $rootScope, localStorageService, mapService, routerService, hashService, snappingService, elevationProvider)]);
    app.service(Common.Constants.hashService, [Common.Constants.location, Common.Constants.rootScope, Common.Constants.localStorageService,
        ($location: angular.ILocationService, $rootScope: angular.IRootScopeService, localStorageService: angular.local.storage.ILocalStorageService) =>
            new Services.HashService($location, $rootScope, localStorageService)]);
    app.service(Common.Constants.layersService, [Common.Constants.http, Common.Constants.window, Common.Constants.mapService, Common.Constants.localStorageService, Common.Constants.drawingFactory, Common.Constants.hashService,
        ($http: angular.IHttpService, $window: angular.IWindowService, mapService: Services.MapService, localStorageService: angular.local.storage.ILocalStorageService, drawingFactory: Services.Drawing.DrawingFactory, hashService: Services.HashService) =>
            new Services.LayersService($http, $window, mapService, localStorageService, drawingFactory, hashService)]);

    app.controller(Common.Constants.mainMapController, [Common.Constants.scope, Common.Constants.compile, Common.Constants.mapService, Common.Constants.hashService, Common.Constants.sidebarService,
        ($scope: Controllers.IMainMapScope, $compile: angular.ICompileService, mapService: Services.MapService, hashService: Services.HashService, sidebarService: Services.SidebarService )=>
            new Controllers.MainMapcontoller($scope, $compile, mapService, hashService, sidebarService)]);
    
    // Directives:
    app.directive("syncFocusWith", () => new Directives.SyncFocusWithDirective());
    app.directive("draggableMovable", [Common.Constants.window, ($window: angular.IWindowService) => new Directives.DraggableMovableDirective($window)]);
    app.directive("disableMapMovement", [Common.Constants.mapService, (mapService: Services.MapService) => new Directives.DisableMapMovementDirective(mapService)]);
    app.directive("markerPopup", () => ({
        controller: Controllers.MarkerPopupController,
        templateUrl: "controllers/markerPopup.html"
    } as angular.IDirective));
    app.directive("drawingControl", () => ({
        controller: Controllers.DrawingController,
        templateUrl: "controllers/drawing.html"
    } as angular.IDirective));
    app.directive("editOsmControl", () => ({
            controller: Controllers.EditOSMController,
            templateUrl: "controllers/editOSM.html"
        } as angular.IDirective));
    app.directive("fileControl", () => ({
        controller: Controllers.FileController,
        templateUrl: "controllers/file.html"
    } as angular.IDirective));
    app.directive("infoHelpControl", () => ({
        controller: Controllers.InfoHelpController,
        templateUrl: "controllers/infoHelp.html"
    } as angular.IDirective));
    app.directive("layersControl", () => ({
        controller: Controllers.LayersController,
        templateUrl: "controllers/layers.html"
    } as angular.IDirective));
    app.directive("searchControl", () => ({
        controller: Controllers.SearchController,
        templateUrl: "controllers/search.html"
    } as angular.IDirective));
    app.directive("shareControl", () => ({
        controller: Controllers.ShareController,
        templateUrl: "controllers/share.html"
    } as angular.IDirective));
    app.directive("saveAsControl", () => ({
        controller: Controllers.FileController,
        templateUrl: "controllers/fileSaveAs.html"
    } as angular.IDirective));
    app.directive("zoomControl", () => ({
        controller: Controllers.ZoomController,
        templateUrl: "controllers/zoom.html"
    } as angular.IDirective));
    app.directive("infoSidebar", () => ({
        controller: Controllers.InfoHelpController,
        templateUrl: "controllers/infoSidebar.html"
    } as angular.IDirective));
    app.directive("helpSidebar", () => ({
        controller: Controllers.InfoHelpController,
        templateUrl: "controllers/helpSidebar.html"
    } as angular.IDirective));
    app.directive("layersSidebar", () => ({
        controller: Controllers.LayersController,
        templateUrl: "controllers/layersSidebar.html"
    } as angular.IDirective));

    app.run(["googleChartApiPromise", () => {
        angular.element("link[type*=icon]").detach().appendTo("head");
    }]);

    app.config($compileProvider => {
        $compileProvider.aHrefSanitizationWhitelist(/[.*facebook][^\s*(whatsapp):]/);
    });
}