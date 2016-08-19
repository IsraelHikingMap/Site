namespace IsraelHiking {
    export var app = angular.module("IsraelHiking", [
        "ngFileUpload", "LocalStorageModule", "angularResizable",
        "angular-loading-bar", "googlechart", "ngAnimate",
        "toastr", "ngFileSaver", "rzModule", "ui.bootstrap"]);

    L.Icon.Default.imagePath = "content/images/";

    // Services:
    app.service(Strings.Services.mapService, [() => new Services.MapService()]);
    app.service(Strings.Services.parserFactory, [() => new Services.Parsers.ParserFactory()]);
    app.service(Strings.Services.sidebarService, [() => new Services.SidebarService()]);
    app.service(Strings.Services.routeStatisticsService, [() => new Services.RouteStatisticsService()]);
    app.service(Strings.Services.searchResultsProviderFactory, [Strings.Angular.http, Strings.Angular.q, Strings.Services.parserFactory,
        ($http: angular.IHttpService, $q: angular.IQService, parserFactory: Services.Parsers.ParserFactory) =>
            new Services.Search.SearchResultsProviderFactory($http, $q, parserFactory)]);
    app.service(Strings.Services.microsoftElevationProvider, [Strings.Angular.http, Strings.Services.toastr,
        ($http: angular.IHttpService, toastr: Toastr) =>
            new Services.Elevation.MicrosoftElevationProvider($http, toastr)]);
    app.service(Strings.Services.elevationProvider, [Strings.Angular.http, Strings.Services.toastr,
        ($http: angular.IHttpService, toastr: Toastr) =>
            new Services.Elevation.ElevationProvider($http, toastr)]);
    app.service(Strings.Services.routerService, [Strings.Angular.http, Strings.Angular.q, Strings.Services.toastr, Strings.Services.parserFactory,
        ($http: angular.IHttpService, $q: angular.IQService, toastr: Toastr, parserFactory: Services.Parsers.ParserFactory) =>
            new Services.Routers.RouterService($http, $q, toastr, parserFactory)]);
    app.service(Strings.Services.fileService, [Strings.Angular.http, Strings.Services.upload, Strings.Services.fileSaver,
        ($http: angular.IHttpService, upload: angular.angularFileUpload.IUploadService, fileSaver: Services.IFileSaver) =>
            new Services.FileService($http, upload, fileSaver)]);
    app.service(Strings.Services.snappingService, [Strings.Angular.http, Strings.Services.mapService, Strings.Services.parserFactory, Strings.Services.toastr,
        ($http: angular.IHttpService, mapService: Services.MapService, parserFactory: Services.Parsers.ParserFactory, toastr: Toastr) =>
            new Services.SnappingService($http, mapService, parserFactory, toastr)]);
    app.service(Strings.Services.routeLayerFactory,
        [Strings.Angular.q, Strings.Angular.compile, Strings.Angular.rootScope, Strings.Angular.timeout, Strings.Services.localStorageService,
            Strings.Services.mapService, Strings.Services.routerService, Strings.Services.snappingService, Strings.Services.elevationProvider,
            ($q: angular.IQService, $compile: angular.ICompileService, $rootScope: angular.IRootScopeService, $timeout: angular.ITimeoutService, localStorageService: angular.local.storage.ILocalStorageService, mapService: Services.MapService, routerService: Services.Routers.RouterService, snappingService: Services.SnappingService, elevationProvider: Services.Elevation.IElevationProvider) =>
                new Services.Layers.RouteLayers.RouteLayerFactory($q, $compile, $rootScope, $timeout, localStorageService, mapService, routerService, snappingService, elevationProvider)]);
    app.service(Strings.Services.hashService, [Strings.Angular.location, Strings.Angular.rootScope, Strings.Services.localStorageService,
        ($location: angular.ILocationService, $rootScope: angular.IRootScopeService, localStorageService: angular.local.storage.ILocalStorageService) =>
            new Services.HashService($location, $rootScope, localStorageService)]);
    app.service(Strings.Services.layersService, [Strings.Angular.http, Strings.Angular.window, Strings.Services.mapService,
        Strings.Services.localStorageService, Strings.Services.routeLayerFactory, Strings.Services.hashService,
        ($http: angular.IHttpService, $window: angular.IWindowService, mapService: Services.MapService, localStorageService: angular.local.storage.ILocalStorageService, routeLayerFactory: Services.Layers.RouteLayers.RouteLayerFactory, hashService: Services.HashService) =>
            new Services.Layers.LayersService($http, $window, mapService, localStorageService, routeLayerFactory, hashService)]);

    app.controller(Strings.Controllers.mainMapController, [Strings.Angular.scope, Strings.Angular.compile, Strings.Services.mapService,
        Strings.Services.hashService, Strings.Services.sidebarService, Strings.Services.routeStatisticsService,
        ($scope: Controllers.IMainMapScope, $compile: angular.ICompileService, mapService: Services.MapService,
            hashService: Services.HashService, sidebarService: Services.SidebarService, routeStatisticsService: Services.RouteStatisticsService) =>
            new Controllers.MainMapcontoller($scope, $compile, mapService, hashService, sidebarService, routeStatisticsService)]);
    
    // Directives:
    app.directive(Strings.Directives.syncFocusWith, () => new Directives.SyncFocusWithDirective());
    app.directive(Strings.Directives.disableMapMovement, [Strings.Services.mapService, (mapService: Services.MapService) => new Directives.DisableMapMovementDirective(mapService)]);
    app.directive(Strings.Directives.markerPopup, () => ({
        controller: Controllers.MarkerPopupController,
        templateUrl: "controllers/markerPopup.html"
    } as angular.IDirective));
    app.directive(Strings.Directives.routePointPopup, () => ({
        templateUrl: "controllers/routePointPopup.html"
    } as angular.IDirective));
    app.directive(Strings.Directives.drawingControl, () => ({
        controller: Controllers.DrawingController,
        templateUrl: "controllers/drawing.html"
    } as angular.IDirective));
    app.directive(Strings.Directives.editOsmControl, () => ({
            controller: Controllers.EditOSMController,
            templateUrl: "controllers/editOSM.html"
        } as angular.IDirective));
    app.directive(Strings.Directives.fileControl, () => ({
        controller: Controllers.FileController,
        templateUrl: "controllers/file.html"
    } as angular.IDirective));
    app.directive(Strings.Directives.infoHelpControl, () => ({
        controller: Controllers.InfoHelpController,
        templateUrl: "controllers/infoHelp.html"
    } as angular.IDirective));
    app.directive(Strings.Directives.layersControl, () => ({
        controller: Controllers.LayersController,
        templateUrl: "controllers/layers.html"
    } as angular.IDirective));
    app.directive(Strings.Directives.searchControl, () => ({
        controller: Controllers.SearchController,
        templateUrl: "controllers/search.html"
    } as angular.IDirective));
    app.directive(Strings.Directives.shareControl, () => ({
        controller: Controllers.ShareController,
        templateUrl: "controllers/share.html"
    } as angular.IDirective));
    app.directive(Strings.Directives.saveAsControl, () => ({
        controller: Controllers.FileController,
        templateUrl: "controllers/fileSaveAs.html"
    } as angular.IDirective));
    app.directive(Strings.Directives.zoomControl, () => ({
        controller: Controllers.ZoomController,
        templateUrl: "controllers/zoom.html"
    } as angular.IDirective));
    app.directive(Strings.Directives.infoSidebar, () => ({
        controller: Controllers.InfoHelpController,
        templateUrl: "controllers/infoSidebar.html"
    } as angular.IDirective));
    app.directive(Strings.Directives.helpSidebar, () => ({
        controller: Controllers.InfoHelpController,
        templateUrl: "controllers/helpSidebar.html"
    } as angular.IDirective));
    app.directive(Strings.Directives.layersSidebar, () => ({
        controller: Controllers.LayersController,
        templateUrl: "controllers/layersSidebar.html"
    } as angular.IDirective));

    app.directive(Strings.Directives.draggable, [Strings.Angular.document, ($document: angular.IDocumentService) => new Directives.DraggableDirective($document)]);
    app.directive(Strings.Directives.routeStatisticsPopup, () => ({
        controller: Controllers.RouteStatisticsController,
        templateUrl: "controllers/routeStatisticsTooltip.html"
    } as angular.IDirective));

    app.run([Strings.Services.googleChartApiPromise, () => {
        angular.element("link[type*=icon]").detach().appendTo("head");
    }]);

    app.config($compileProvider => {
        $compileProvider.aHrefSanitizationWhitelist(/[.*facebook][^\s*(whatsapp):]/);
    });
}