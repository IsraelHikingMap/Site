module IsraelHiking.Services.Drawing {
    export class DrawingFactory {
        $q: angular.IQService;
        $compile: angular.ICompileService;
        $rootScope: angular.IRootScopeService;
        mapService: MapService;
        routeFactory: Routers.RouterFactory;
        hashService: HashService;
        snappingService: SnappingService;

        constructor($q: angular.IQService,
            $compile: angular.ICompileService,
            $rootScope: angular.IRootScopeService,
            mapService: MapService,
            routeFactory: Routers.RouterFactory,
            hashService: HashService,
            snappingService: SnappingService) {
            this.$q = $q;
            this.$compile = $compile;
            this.$rootScope = $rootScope;
            this.mapService = mapService;
            this.routeFactory = routeFactory;
            this.hashService = hashService;
            this.snappingService = snappingService;
        }

        public createDrawingRoute = (routeData: Common.RouteData, reroute: boolean): DrawingRoute => {
            var drawingRoute = new DrawingRoute(this.$q, this.mapService, this.routeFactory, this.hashService, this.snappingService, routeData.name);
            drawingRoute.setData(routeData);
            if (reroute) {
                drawingRoute.reroute();
            }
            return drawingRoute;
        }

        public createDrawingMarker = (markersData: Common.MarkerData[]): DrawingMarker => {
            var drawingMarker = new DrawingMarker(this.$compile, this.$rootScope, this.mapService, this.hashService);
            drawingMarker.setData(markersData);
            return drawingMarker;
        }
    }
} 