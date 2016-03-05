module IsraelHiking.Services.Drawing {
    export class DrawingFactory {
        private $q: angular.IQService;
        private $compile: angular.ICompileService;
        private $rootScope: angular.IRootScopeService;
        private mapService: MapService;
        private routerService: Routers.RouterService;
        private hashService: HashService;
        private snappingService: SnappingService;
        private elevationProvider: Elevation.IElevationProvider;
        private nextColorIndex = 0;

        constructor($q: angular.IQService,
            $compile: angular.ICompileService,
            $rootScope: angular.IRootScopeService,
            mapService: MapService,
            routerService: Routers.RouterService,
            hashService: HashService,
            snappingService: SnappingService,
            elevationProvider: Elevation.IElevationProvider) {
            this.$q = $q;
            this.$compile = $compile;
            this.$rootScope = $rootScope;
            this.mapService = mapService;
            this.routerService = routerService;
            this.hashService = hashService;
            this.snappingService = snappingService;
            this.elevationProvider = elevationProvider;
        }

        public createDrawingRoute = (routeData: Common.RouteData, reroute: boolean, pathOptions?: L.PathOptions): DrawingRoute => {
            if (pathOptions == null) {
                pathOptions = this.createPathOptions();
            }
            var drawingRoute = new DrawingRoute(this.$q,
                this.mapService,
                this.routerService,
                this.hashService,
                this.snappingService,
                this.elevationProvider,
                routeData.name,
                pathOptions);
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

        public createPathOptions = (): L.PathOptions => {
            let newPathOptions = {
                color: Common.Constants.COLORS[this.nextColorIndex].value,
                weight: 4,
                opacity: 0.5,
                dashArray: null,
                className: ""
            } as L.PathOptions;
            this.nextColorIndex = (this.nextColorIndex + 1) % Common.Constants.COLORS.length;
            return newPathOptions;
        }
    }
} 