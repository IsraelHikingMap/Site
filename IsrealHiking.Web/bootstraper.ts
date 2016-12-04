namespace IsraelHiking {

    export interface IRootScope extends angular.IScope {
        resources: Services.ResourcesService;
        hasHebrewCharacters(word: string): boolean;
    }

    export var app = angular.module("IsraelHiking", [
        "ngFileUpload", "LocalStorageModule", "ui.bootstrap-slider",
        "angular-loading-bar", "googlechart", "ngAnimate", "gettext",
        "toastr", "ngFileSaver", "ui.bootstrap", "angular-clipboard",
        "angulartics", "angulartics.google.analytics"]);

    L.Icon.Default.imagePath = "content/images/";

    // Services:
    app.service(Strings.Services.mapService, [() => new Services.MapService()]);
    app.service(Strings.Services.geoJsonParser, [() => new Services.Parsers.GeoJsonParser()]);
    app.service(Strings.Services.sidebarService, [() => new Services.SidebarService()]);
    app.service(Strings.Services.authorizationInterceptorService, [Strings.Angular.q, Strings.Angular.injector, Strings.Services.localStorageService,
        ($q: angular.IQService, $injector: angular.auto.IInjectorService, localStorageService: angular.local.storage.ILocalStorageService) =>
            new Services.AuthorizationInterceptorService($q, $injector, localStorageService)]);
    app.service(Strings.Services.osmUserService, [Strings.Angular.q, Strings.Angular.http, Strings.Services.localStorageService,
        ($q: angular.IQService, $http: angular.IHttpService, localStorageService: angular.local.storage.ILocalStorageService) =>
            new Services.OsmUserService($q, $http, localStorageService)]);
    app.service(Strings.Services.routeStatisticsService, [() => new Services.RouteStatisticsService()]);
    app.service(Strings.Services.resourcesService, [Strings.Angular.sce, Strings.Services.localStorageService, Strings.Services.gettextCatalog,
        ($sce: angular.ISCEService, localstorageService: angular.local.storage.ILocalStorageService, gettextCatalog: angular.gettext.gettextCatalog) =>
            new Services.ResourcesService($sce, localstorageService, gettextCatalog)]);
    app.service(Strings.Services.localSearchResultsProvider, [Strings.Angular.http, Strings.Angular.q,
        ($http: angular.IHttpService, $q: angular.IQService) =>
            new Services.Search.LocalSearchResultsProvider($http, $q)]);
    app.service(Strings.Services.microsoftElevationProvider, [Strings.Angular.http, Strings.Services.resourcesService, Strings.Services.toastr,
        ($http: angular.IHttpService, resourcesService: Services.ResourcesService, toastr: Toastr) =>
            new Services.Elevation.MicrosoftElevationProvider($http, resourcesService, toastr)]);
    app.service(Strings.Services.elevationProvider, [Strings.Angular.http, Strings.Services.resourcesService, Strings.Services.toastr,
        ($http: angular.IHttpService, resourcesService: Services.ResourcesService, toastr: Toastr) =>
            new Services.Elevation.ElevationProvider($http, resourcesService, toastr)]);
    app.service(Strings.Services.routerService, [Strings.Angular.http, Strings.Angular.q, Strings.Services.resourcesService, Strings.Services.toastr, Strings.Services.geoJsonParser,
        ($http: angular.IHttpService, $q: angular.IQService, resourcesService: Services.ResourcesService, toastr: Toastr, geoJsonParser: Services.Parsers.GeoJsonParser) =>
            new Services.Routers.RouterService($http, $q, resourcesService, toastr, geoJsonParser)]);
    app.service(Strings.Services.fileService, [Strings.Angular.http, Strings.Services.upload, Strings.Services.fileSaver,
        ($http: angular.IHttpService, upload: angular.angularFileUpload.IUploadService, fileSaver: Services.IFileSaver) =>
            new Services.FileService($http, upload, fileSaver)]);
    app.service(Strings.Services.snappingService, [Strings.Angular.http, Strings.Services.resourcesService, Strings.Services.mapService, Strings.Services.toastr,
        ($http: angular.IHttpService, resourcesService: Services.ResourcesService, mapService: Services.MapService, toastr: Toastr) =>
            new Services.SnappingService($http, resourcesService, mapService, toastr)]);
    app.service(Strings.Services.routeLayerFactory,
        [Strings.Angular.q, Strings.Angular.compile, Strings.Angular.rootScope, Strings.Angular.timeout, Strings.Services.localStorageService,
            Strings.Services.mapService, Strings.Services.routerService, Strings.Services.snappingService, Strings.Services.elevationProvider,
            ($q: angular.IQService, $compile: angular.ICompileService, $rootScope: angular.IRootScopeService, $timeout: angular.ITimeoutService, localStorageService: angular.local.storage.ILocalStorageService, mapService: Services.MapService, routerService: Services.Routers.RouterService, snappingService: Services.SnappingService, elevationProvider: Services.Elevation.IElevationProvider) =>
                new Services.Layers.RouteLayers.RouteLayerFactory($q, $compile, $rootScope, $timeout, localStorageService, mapService, routerService, snappingService, elevationProvider)]);
    app.service(Strings.Services.hashService, [Strings.Angular.location, Strings.Angular.rootScope, Strings.Services.localStorageService,
        ($location: angular.ILocationService, $rootScope: angular.IRootScopeService, localStorageService: angular.local.storage.ILocalStorageService) =>
            new Services.HashService($location, $rootScope, localStorageService)]);
    app.service(Strings.Services.layersService, [Strings.Angular.http, Strings.Angular.q, Strings.Services.mapService,
        Strings.Services.localStorageService, Strings.Services.routeLayerFactory, Strings.Services.hashService, Strings.Services.fileService, Strings.Services.resourcesService, Strings.Services.toastr,
        ($http: angular.IHttpService, $q: angular.IQService, mapService: Services.MapService, localStorageService: angular.local.storage.ILocalStorageService,
            routeLayerFactory: Services.Layers.RouteLayers.RouteLayerFactory, hashService: Services.HashService, fileService: Services.FileService, resourcesService: Services.ResourcesService, toastr: Toastr) =>
            new Services.Layers.LayersService($http, $q, mapService, localStorageService, routeLayerFactory, hashService, fileService, resourcesService, toastr)]);
    app.service(Strings.Services.dragAndDropService, [Strings.Angular.timeout, Strings.Services.resourcesService, Strings.Services.mapService, Strings.Services.fileService, Strings.Services.layersService, Strings.Services.toastr,
        ($timeout: angular.ITimeoutService, resourcesService: Services.ResourcesService, mapservice: Services.MapService, fileService: Services.FileService, layersService: Services.Layers.LayersService, toastr: Toastr) =>
            new Services.DragAndDropService($timeout, resourcesService, mapservice, fileService, layersService, toastr)
    ]);

    app.controller(Strings.Controllers.mainMapController, [Strings.Angular.scope, Strings.Angular.location, Strings.Angular.window,
        Strings.Angular.compile, Strings.Angular.timeout, Strings.Services.mapService,
        Strings.Services.hashService, Strings.Services.sidebarService, Strings.Services.routeStatisticsService, Strings.Services.toastr,
        ($scope: Controllers.IMainMapScope, $location: angular.ILocationService, $window: angular.IWindowService,
            $compile: angular.ICompileService, $timeout: angular.ITimeoutService, mapService: Services.MapService,
            hashService: Services.HashService, sidebarService: Services.SidebarService, routeStatisticsService: Services.RouteStatisticsService, toastr: Toastr) =>
            new Controllers.MainMapcontoller($scope, $location, $window, $compile, $timeout, mapService, hashService, sidebarService, routeStatisticsService, toastr)]);

    // Directives:
    app.directive(Strings.Directives.disableMapMovement, () => new Directives.DisableMapMovementDirective());
    app.directive(Strings.Directives.syncFocusWith, [Strings.Angular.timeout, ($timeout: angular.ITimeoutService) => new Directives.SyncFocusWithDirective($timeout)]);
    app.directive(Strings.Directives.markerPopup, () => ({
        controller: Controllers.MarkerPopupController,
        templateUrl: "controllers/markerPopup.html"
    } as angular.IDirective));
    app.directive(Strings.Directives.routePointPopup, () => ({
        controller: Controllers.MarkerPopupController,
        templateUrl: "controllers/routePointPopup.html"
    } as angular.IDirective));
    app.directive(Strings.Directives.searchResultsMarkerPopup, () => ({
        controller: Controllers.MarkerPopupController,
        templateUrl: "controllers/searchResultsMarkerPopup.html"
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
    app.directive(Strings.Directives.infoControl, () => ({
        controller: Controllers.InfoController,
        templateUrl: "controllers/info.html"
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
    app.directive(Strings.Directives.osmUserControl, () => ({
        controller: Controllers.OsmUserController,
        templateUrl: "controllers/osmUser.html"
    } as angular.IDirective));
    app.directive(Strings.Directives.zoomControl, () => ({
        controller: Controllers.ZoomController,
        templateUrl: "controllers/zoom.html"
    } as angular.IDirective));
    app.directive(Strings.Directives.languageControl, () => ({
        controller: Controllers.LanguageController,
        templateUrl: "controllers/language.html"
    } as angular.IDirective));
    app.directive(Strings.Directives.infoSidebar, () => ({
        controller: Controllers.InfoController,
        templateUrl: "controllers/infoSidebar.html"
    } as angular.IDirective));
    app.directive(Strings.Directives.layersSidebar, () => ({
        controller: Controllers.LayersController,
        templateUrl: "controllers/layersSidebar.html"
    } as angular.IDirective));

    app.directive(Strings.Directives.draggableResizable, [Strings.Angular.document, Strings.Angular.timeout, Strings.Angular.window,
        ($document: angular.IDocumentService, $timeout: angular.ITimeoutService, $window: angular.IWindowService) =>
            new Directives.DraggableResizableDirective($document, $timeout, $window)]);
    app.directive(Strings.Directives.routeStatisticsPopup, () => ({
        controller: Controllers.RouteStatisticsController,
        templateUrl: "controllers/routeStatistics.html"
    } as angular.IDirective));

    app.run([Strings.Angular.rootScope, Strings.Services.resourcesService, Strings.Services.googleChartApiPromise, Strings.Services.dragAndDropService,
        ($rootScope: IRootScope, resourcesService: Services.ResourcesService) => {
            angular.element("link[type*=icon]").detach().appendTo("head");
            $rootScope.resources = resourcesService;
            $rootScope.hasHebrewCharacters = hasHebrewCharacters;
        }]);

    app.config(($compileProvider, $httpProvider, toastrConfig) => {
        $compileProvider.aHrefSanitizationWhitelist(/[.*facebook][^\s*(whatsapp):]/);
        $compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|orux-map|locus-actions|offroad):/);
        angular.extend(toastrConfig, { positionClass: "toast-top-center" });
        $httpProvider.interceptors.push(Strings.Services.authorizationInterceptorService);
    });

    export function hasHebrewCharacters(word: string): boolean {
        return word && (word.match(/[\u0590-\u05FF]/gi) != null);
    }
}