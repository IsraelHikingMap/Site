namespace IsraelHiking.Services.Layers.RouteLayers {

    export interface IRouteSegment extends Common.RouteSegmentData {
        routePointMarker: L.Marker;
        polyline: L.Polyline;
    }

    export interface IMarkerWithData extends Common.MarkerData {
        marker: Common.IMarkerWithTitle;
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

    export class RouteLayer extends L.Layer implements IDrawingLayer {
        public $q: angular.IQService;
        public $rootScope: angular.IRootScopeService;
        public $compile: angular.ICompileService;
        public $timeout: angular.ITimeoutService;
        public snappingService: SnappingService;
        public routerService: Routers.RouterService;
        public elevationProvider: Elevation.IElevationProvider;
        public route: IRoute;
        public dataChangedEvent: Common.EventHelper<{}>;
        public polylineHoverEvent: Common.EventHelper<L.LatLng>;

        private currentState: RouteStateBase;
        private undoHandler: UndoHandler<Common.RouteData>;
        public map: L.Map;

        constructor($q: angular.IQService,
            $rootScope: angular.IRootScopeService,
            $compile: angular.ICompileService,
            $timeout: angular.ITimeoutService,
            mapService: MapService,
            snappingService: SnappingService,
            routerService: Routers.RouterService,
            elevationProvider: Elevation.IElevationProvider,
            route: IRoute) {
            super();
            this.map = mapService.map;
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
            this.dataChangedEvent = new Common.EventHelper<{}>();
            this.polylineHoverEvent = new Common.EventHelper<L.LatLng>();
        }

        public onAdd(map: L.Map): this {
            this.route.properties.isVisible = true;
            this.currentState.setReadOnlyState();
            return this;
        }

        public onRemove(map: L.Map): this {
            this.currentState.setHiddenState();
            this.route.properties.isVisible = false;
            return this;
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
                    latlngs: angular.copy(segment.latlngs),
                    routingType: segment.routingType
                } as Common.RouteSegmentData);
            }
            let markersData = [] as Common.MarkerData[];
            for (let marker of this.route.markers) {
                markersData.push({
                    title: marker.title,
                    latlng: marker.latlng,
                    type: marker.type
                });
            }
            return {
                name: this.route.properties.name,
                color: this.route.properties.pathOptions.color,
                opacity: this.route.properties.pathOptions.opacity,
                weight: this.route.properties.pathOptions.weight,
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

        public dataChanged = () => {
            var data = this.getData();
            this.undoHandler.addDataToUndoStack(data);
            this.dataChangedEvent.raiseEvent({});
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
                currentSegment.latlngs = nextSegment.latlngs.reverse();
                currentSegment.routingType = nextSegment.routingType;
            }
            var lastSegment = data.segments[data.segments.length - 1];
            var lastPoint = lastSegment.latlngs[0]; // this is becuase we already reversed that segment's points
            lastSegment.latlngs = [lastPoint, lastPoint];
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

        public getBounds = (): L.LatLngBounds => {
            if (this.route.segments.length === 0) {
                return null;
            }
            let featureGroup = L.featureGroup([]);
            for (let segment of this.route.segments) {
                featureGroup.addLayer(L.polyline(segment.latlngs));
            }
            let bounds = featureGroup.getBounds();
            featureGroup.clearLayers();
            return bounds;
        }
    }
}