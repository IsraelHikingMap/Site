namespace IsraelHiking.Services.Layers.RouteLayers {
    export class RouteLayerFactory {
        public static IS_ROUTING_PER_POINT_KEY = "is-routing-per-point";
        public static ROUTING_TYPE = "routing-type";
        public static ROUTE_OPACITY = "routeOpacity";

        public static COLORS = [
            { key: "blue", value: "#0000FF" },
            { key: "red", value: "#FF0000" },
            { key: "orange", value: "#FF6600" },
            { key: "pink", value: "#FF00DD" },
            { key: "green", value: "#008000" },
            { key: "purple", value: "#B700FF" },
            { key: "turquize", value: "#00B0A4" },
            { key: "yellow", value: "#FFFF00" },
            { key: "brown", value: "#9C3E00" },
            { key: "cyan", value: "#00FFFF" },
            { key: "gray", value: "#7F8282" },
            { key: "dark", value: "#101010" }
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
                this.mapService,
                this.snappingService,
                this.routerService,
                this.elevationProvider,
                route);
        }

        public createPoiLayer = (): PoiLayers.PoiLayer => {
            return new PoiLayers.PoiLayer(this.$rootScope, this.$compile, this.$timeout, this.mapService);
        }

        public createRoute(name: string): IRoute {
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
                        color: RouteLayerFactory.COLORS[this.nextColorIndex].value,
                        className: "",
                        opacity: this.localStorageService.get(RouteLayerFactory.ROUTE_OPACITY) as number || 0.5,
                        weight: 4
                    } as L.PathOptions
                } as IRouteProperties,
                markers: [],
                segments: []
            } as RouteLayers.IRoute;
            this.nextColorIndex = (this.nextColorIndex + 1) % RouteLayerFactory.COLORS.length;
            return route;
        }

        public createRouteFromData(routeData: Common.RouteData): IRoute {
            let route = this.createRoute(routeData.name);
            route.segments = routeData.segments as IRouteSegment[];
            return route;
        }
    }
}