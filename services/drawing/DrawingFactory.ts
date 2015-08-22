module IsraelHiking.Services.Drawing {
    export class DrawingFactory {
        private $q: angular.IQService;
        private $compile: angular.ICompileService;
        private $rootScope: angular.IRootScopeService;
        private mapService: MapService;
        private routeFactory: Routers.RouterFactory;
        private hashService: HashService;
        private snappingService: SnappingService;
        private heightService: HeightService;
        private NextColorIndex = 0;

        constructor($q: angular.IQService,
            $compile: angular.ICompileService,
            $rootScope: angular.IRootScopeService,
            mapService: MapService,
            routeFactory: Routers.RouterFactory,
            hashService: HashService,
            snappingService: SnappingService,
            heightService: HeightService) {
            this.$q = $q;
            this.$compile = $compile;
            this.$rootScope = $rootScope;
            this.mapService = mapService;
            this.routeFactory = routeFactory;
            this.hashService = hashService;
            this.snappingService = snappingService;
            this.heightService = heightService;
        }

        public createDrawingRoute = (routeData: Common.RouteData, reroute: boolean, pathOptions: L.PathOptions): DrawingRoute => {
            if (pathOptions == null) {
                pathOptions = this.createPathOptions();
            }
            var drawingRoute = new DrawingRoute(this.$q, this.mapService, this.routeFactory, this.hashService, this.snappingService, this. heightService, routeData.name, pathOptions);
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
            var nextColorIndex = this.NextColorIndex;
            this.NextColorIndex = (this.NextColorIndex + 1) % Common.Constants.COLORS.length;
            return <L.PathOptions> { color: Common.Constants.COLORS[nextColorIndex], weight: 4, opacity: 0.5 };
        }
    }
} 