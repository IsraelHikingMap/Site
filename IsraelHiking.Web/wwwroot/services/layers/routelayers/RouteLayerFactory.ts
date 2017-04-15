namespace IsraelHiking.Services.Layers.RouteLayers {
    export class RouteLayerFactory {
        public static IS_ROUTING_PER_POINT_KEY = "is-routing-per-point";
        public static ROUTING_TYPE = "routing-type";
        public static ROUTE_OPACITY = "routeOpacity";

        // default values - in case the response from server takes too long.
        public static COLORS: string[] = [
            "#0000FF",
            "#FF0000",
            "#FF6600",
            "#FF00DD",
            "#008000",
            "#B700FF",
            "#00B0A4",
            "#FFFF00",
            "#9C3E00",
            "#00FFFF",
            "#7F8282",
            "#101010"
        ];

        private $q: angular.IQService;
        private $compile: angular.ICompileService;
        private $rootScope: angular.IRootScopeService;
        private $timeout: angular.ITimeoutService;
        private localStorageService: angular.local.storage.ILocalStorageService;
        private mapService: MapService;
        private routerService: Routers.RouterService;
        private snappingService: SnappingService;
        private elevationProvider: Elevation.IElevationProvider;
        private nextColorIndex = 0;

        constructor($q: angular.IQService,
            $compile: angular.ICompileService,
            $rootScope: angular.IRootScopeService,
            $timeout: angular.ITimeoutService,
            $http: angular.IHttpService,
            localStorageService: angular.local.storage.ILocalStorageService,
            mapService: MapService,
            routerService: Routers.RouterService,
            snappingService: SnappingService,
            elevationProvider: Elevation.IElevationProvider) {
            this.$q = $q;
            this.$compile = $compile;
            this.$rootScope = $rootScope;
            this.$timeout = $timeout;
            this.localStorageService = localStorageService;
            this.mapService = mapService;
            this.routerService = routerService;
            this.snappingService = snappingService;
            this.elevationProvider = elevationProvider;
            $http.get(Common.Urls.colors).then((colors: { data: string[] }) => {
                RouteLayerFactory.COLORS.splice(0, RouteLayerFactory.COLORS.length, ...colors.data);
            });
        }

        public createRouteLayerFromData = (routeData: Common.RouteData, reRoute: boolean): RouteLayer => {
            let routeLayer = this.createRouteLayer(this.createRouteFromData(routeData));
            if (reRoute) {
                routeLayer.reRoute();
            }
            return routeLayer;
        }

        public createRouteLayer = (route: IRoute): RouteLayer => {
            return new RouteLayer(this.$q,
                this.$rootScope,
                this.$compile,
                this.$timeout,
                this.mapService,
                this.snappingService,
                this.routerService,
                this.elevationProvider,
                route);
        }

        private createRouteImplementation(name: string, pathOptions: L.PathOptions): IRoute {
            let isRoutingPerPoint = this.localStorageService.get(RouteLayerFactory.IS_ROUTING_PER_POINT_KEY);
            if (isRoutingPerPoint == null) {
                isRoutingPerPoint = true;
            }
            let route = {
                properties: {
                    name: name,
                    currentRoutingType: this.localStorageService.get(RouteLayerFactory.ROUTING_TYPE) || "Hike",
                    isRoutingPerPoint: isRoutingPerPoint,
                    isVisible: true,
                    pathOptions: {
                        color: pathOptions.color || RouteLayerFactory.COLORS[this.nextColorIndex],
                        className: "",
                        opacity: pathOptions.opacity || this.localStorageService.get(RouteLayerFactory.ROUTE_OPACITY) as number || 0.5,
                        weight: pathOptions.weight || 4
                    } as L.PathOptions
                } as IRouteProperties,
                markers: [],
                segments: []
            } as RouteLayers.IRoute;
            this.nextColorIndex = (this.nextColorIndex + 1) % RouteLayerFactory.COLORS.length;
            return route;
        }

        public createRoute(name: string): IRoute {
            return this.createRouteImplementation(name, { color: "", opacity: null, weight: null } as L.PathOptions)
        }

        public createRouteFromData(routeData: Common.RouteData): IRoute {
            let pathOptions = { color: routeData.color, opacity: routeData.opacity, weight: routeData.weight } as L.PathOptions;
            let route = this.createRouteImplementation(routeData.name, pathOptions);
            route.segments = routeData.segments as IRouteSegment[] || [];
            route.markers = routeData.markers as IMarkerWithData[] || [];
            return route;
        }
    }
}