namespace IsraelHiking.Services.Layers.RouteLayers {

    export interface IRouteSegment extends Common.RouteSegmentData {
        routePointMarker: L.Marker;
        polyline: L.Polyline;
    }

    export interface IMarkerWithTitle extends L.Marker {
        title: string;
    }

    export interface IMarkerWithData extends Common.MarkerData {
        marker: IMarkerWithTitle;
    }

    export interface IRouteProperties {
        name: string;
        pathOptions: L.PathOptions;
        currentRoutingType: Common.RoutingType;
        isRoutingPerPoint: boolean;
        isVisible: boolean;
    }

    export interface IRoute {
        segments: IRouteSegment[];
        markers: IMarkerWithData[];
        properties: IRouteProperties;
    }

    export interface IRouteStatisticsPoint extends L.Point {
        latlng: L.LatLng;
        slope: number;
    }

    export interface IRouteStatistics {
        points: IRouteStatisticsPoint[];
        length: number; // [meters]
        gain: number; // [meters] - adding only when going up hill.
        loss: number; // [meters] - adding only when going downhill - should be negative number.
    }

    export class RouteLayer extends ObjectWithMap implements IDrawingLayer {
        public $q: angular.IQService;
        public $rootScope: angular.IRootScopeService;
        public $compile: angular.ICompileService;
        public $timeout: angular.ITimeoutService;
        public snappingService: SnappingService;
        public routerService: Routers.RouterService;
        public elevationProvider: Elevation.IElevationProvider;
        public route: IRoute;
        public eventHelper: Common.EventHelper<{}>;

        private currentState: RouteStateBase;
        private undoHandler: UndoHandler<Common.RouteData>;

        constructor($q: angular.IQService,
            $rootScope: angular.IRootScopeService,
            $compile: angular.ICompileService,
            $timeout: angular.ITimeoutService,
            mapService: MapService,
            snappingService: SnappingService,
            routerService: Routers.RouterService,
            elevationProvider: Elevation.IElevationProvider,
            route: IRoute) {
            super(mapService);

            this.$q = $q;
            this.$rootScope = $rootScope;
            this.$compile = $compile;
            this.$timeout = $timeout;
            this.snappingService = snappingService;
            this.routerService = routerService;
            this.elevationProvider = elevationProvider;
            this.route = route;
            this.undoHandler = new UndoHandler<Common.RouteData>();
            this.undoHandler.addDataToUndoStack(this.getData());
            this.currentState = new RouteStateReadOnly(this);
            this.eventHelper = new Common.EventHelper<{}>();
        }

        public onAdd(map: L.Map): void {
            this.route.properties.isVisible = true;
            this.currentState.setReadOnlyState();
        }

        public onRemove(map: L.Map): void {
            this.currentState.setHiddenState();
            this.route.properties.isVisible = false;
        }

        public clearCurrentState() {
            this.currentState.clear();
        }

        public setState(state: RouteStateBase) {
            this.currentState = state;
        }

        public getEditMode(): EditMode {
            return this.currentState.getEditMode();
        }

        public editRoute() {
            this.currentState.setEditRouteState();
        }

        public editPoi() {
            this.currentState.setEditPoiState();
        }

        public readOnly() {
            this.currentState.setReadOnlyState();
        }

        public getRouteProperties(): IRouteProperties {
            return this.route.properties;
        }

        public setRouteProperties(properties: IRouteProperties) {
            this.route.properties = properties;
            this.currentState.clear();
            this.currentState.initialize();
        }

        public snapToRoute = (latlng: L.LatLng): ISnappingResponse => {
            var polylines = [];
            for (let segment of this.route.segments) {
                polylines.push(segment.polyline);
            }
            return this.snappingService.snapTo(latlng, {
                sensitivity: 30,
                layers: L.layerGroup(polylines)
            } as ISnappingOptions);
        }

        public getData = (): Common.RouteData => {
            let segmentsData = [] as Common.RouteSegmentData[];
            for (let segment of this.route.segments) {
                segmentsData.push({
                    routePoint: segment.routePoint,
                    latlngzs: angular.copy(segment.latlngzs),
                    routingType: segment.routingType
                } as Common.RouteSegmentData);
            }
            let markersData = [] as Common.MarkerData[];
            for (let marker of this.route.markers) {
                markersData.push({
                    title: marker.title,
                    latlng: marker.latlng,
                    type: marker.type
                } as Common.MarkerData);
            }
            return {
                name: this.route.properties.name,
                markers: markersData,
                segments: segmentsData
            } as Common.RouteData;
        }

        public setData = (data: Common.RouteData) => {
            this.setDataInternal(data);
            this.currentState.initialize();
        }

        public updateDataFromState = () => {
            let data = this.getData();
            this.setDataInternal(data);
        }

        private setDataInternal = (data: Common.RouteData) => {
            this.currentState.clear();
            this.route.segments = [];
            this.route.markers = [];
            for (let segmentData of data.segments) {
                let segment = angular.copy(segmentData) as IRouteSegment;
                segment.polyline = null;
                segment.routePointMarker = null;
                this.route.segments.push(segment);
            }
            for (let markerData of data.markers) {
                let marker = angular.copy(markerData) as IMarkerWithData;
                marker.marker = null;
                this.route.markers.push(marker);
            }
        }

        public getLatLngZFromLatLng = (latlng: L.LatLng): Common.LatLngZ => {
            var latlngz = latlng as Common.LatLngZ;
            latlngz.z = 0;
            return latlngz;
        }

        public getStatistics = (): IRouteStatistics => {
            var routeStatistics = {
                points: [] as IRouteStatisticsPoint[],
                length: 0,
                gain: 0,
                loss: 0
            } as IRouteStatistics;
            if (this.route.segments.length <= 0) {
                return routeStatistics;
            }
            let previousPoint = this.route.segments[0].latlngzs[0];
            for (let segment of this.route.segments) {
                for (let latlngz of segment.latlngzs) {
                    let distance = previousPoint.distanceTo(latlngz);
                    if (distance < 1) {
                        continue;
                    }
                    routeStatistics.length += distance;
                    let point = L.point((routeStatistics.length / 1000), latlngz.z) as IRouteStatisticsPoint;
                    point.latlng = latlngz;
                    point.slope = distance === 0 ? 0 : (latlngz.z - previousPoint.z) * 100 / distance;
                    routeStatistics.points.push(point);
                    previousPoint = latlngz;
                }
            }
            let simplified = L.LineUtil.simplify(routeStatistics.points, 1);
            let previousSimplifiedPoint = simplified[0];
            for (let point of simplified) {
                routeStatistics.gain += ((point.y - previousSimplifiedPoint.y) > 0 && point.y !== 0 && previousSimplifiedPoint.y !== 0) ?
                    (point.y - previousSimplifiedPoint.y) :
                    0;
                routeStatistics.loss += ((point.y - previousSimplifiedPoint.y) < 0 && point.y !== 0 && previousSimplifiedPoint.y !== 0) ?
                    (point.y - previousSimplifiedPoint.y) :
                    0;
                previousSimplifiedPoint = point;
            }

            return routeStatistics;
        }

        public dataChanged = () => {
            var data = this.getData();
            this.undoHandler.addDataToUndoStack(data);
            this.eventHelper.raiseEvent({});
        }

        public clear = () => {
            this.currentState.clear();
            this.route.segments = [];
            this.route.markers = [];
            this.dataChanged();
            this.currentState.initialize();
        }

        public undo = () => {
            this.undoHandler.pop();
            this.setData(this.undoHandler.top());
        }

        public isUndoDisbaled = (): boolean => {
            return this.undoHandler.isUndoDisbaled() || this.currentState.getEditMode() === Strings.DrawingEditMode.none;
        }

        public reverse = () => {
            let data = this.getData();

            for (let segmentIndex = 0; segmentIndex < data.segments.length - 1; segmentIndex++) {
                var currentSegment = data.segments[segmentIndex];
                var nextSegment = data.segments[segmentIndex + 1];
                currentSegment.latlngzs = nextSegment.latlngzs.reverse();
                currentSegment.routingType = nextSegment.routingType;
            }
            var lastSegment = data.segments[data.segments.length - 1];
            var lastPoint = lastSegment.latlngzs[0]; // this is becuase we already reversed that segment's points
            lastSegment.latlngzs = [lastPoint, lastPoint];
            data.segments.reverse();
            this.setData(data);
            this.dataChanged();
        }

        public setRoutingType = (routingType: Common.RoutingType) => {
            this.route.properties.currentRoutingType = routingType;
            if (this.route.properties.isRoutingPerPoint) {
                return;
            }
            for (let segment of this.route.segments) {
                segment.routingType = this.route.properties.currentRoutingType;
            }
            this.reRoute();
            this.dataChanged();
        }

        public reRoute = (): void => {
            if (this.route.segments.length === 0) {
                return;
            }
            this.currentState.reRoute();
        }

        public center = (): void => {
            if (this.route.segments.length === 0) {
                return;
            }
            let featureGroup = L.featureGroup([]);
            for (let segment of this.route.segments) {
                featureGroup.addLayer(L.polyline(segment.latlngzs));
            }
            this.map.fitBounds(featureGroup.getBounds());
            featureGroup.clearLayers();
        }

        public getHtmlTitle(title: string): string {
            let lines = title.split("\n");
            var htmlTitleArray = "";
            for (let line of lines) {
                if (!line) {
                    continue;
                }
                // start with hebrew or not, ignoring non alphabetical characters.
                let direction = (line.match(/^[^a-zA-Z]*[\u0591-\u05F4]/)) ? "rtl" : "ltr";
                htmlTitleArray += `<div dir="${direction}">${line}</div>`;
            }
            return htmlTitleArray;
        }

        public getColorName(): string {
            return _.find(RouteLayerFactory.COLORS, colorToFind => colorToFind.value === this.getRouteProperties().pathOptions.color).key;
        }
    }
}