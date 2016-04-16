module IsraelHiking.Services.Drawing {
    interface IRouteSegment {
        routePoint: L.Marker;
        routePointLatlng: L.LatLng;
        polyline: L.Polyline;
        latlngzs: Common.LatLngZ[];
        routingType: string;
    }

    export interface IRouteStatisticsPoint extends L.Point {
        latlng: L.LatLng;
    }

    export interface IRouteStatistics {
        points: IRouteStatisticsPoint[];
        length: number; // [meters]
        gain: number; // [meters] - adding only when going up hill.
        loss: number; // [meters] - adding only when going downhill - should be negative number.
    }

    class HoverState {
        public static none = "none";
        public static addPoint = "addPoint";
        public static onMarker = "onMarker";
        public static onPolyline = "onPolyline";
        public static dragging = "dragging";
    }

    export class DrawingRoute extends BaseDrawing<Common.RouteData> {
        private static MINIMAL_DISTANCE_BETWEEN_MARKERS = 100; // meter.
        private static IS_ROUTING_PER_POINT_KEY = "isRoutingPerPoint";

        private $q: angular.IQService;
        private localStorageService: angular.local.storage.ILocalStorageService;
        private routerService: Services.Routers.RouterService;
        private snappingService: SnappingService;
        private elevationProvider: Elevation.IElevationProvider;
        private selectedRouteSegmentIndex: number;
        private currentRoutingType: string;
        private hoverPolyline: L.Polyline;
        private hoverMarker: L.Marker;
        private routeSegments: IRouteSegment[];
        private middleMarker: L.Marker;
        private routePointIcon: L.Icon;
        private routePointIconStart: L.Icon;
        private routePointIconEnd: L.Icon;
        private hoverState: string;
        private pathOptions: L.PathOptions;
        private datachangedCallback: Function;
        private showKmMarkers: boolean;
        private kmMarkersGroup: L.LayerGroup<L.Marker>;
        private isRoutingPerPoint: boolean;

        constructor($q: angular.IQService,
            localStorageService: angular.local.storage.ILocalStorageService,
            mapService: MapService,
            routerService: Services.Routers.RouterService,
            hashService: HashService,
            snappingService: SnappingService,
            elevationProvider: Services.Elevation.IElevationProvider,
            name: string,
            pathOptions: L.PathOptions) {
            super(mapService, hashService);
            this.$q = $q;
            this.localStorageService = localStorageService;
            this.routerService = routerService;
            this.snappingService = snappingService;
            this.elevationProvider = elevationProvider;
            this.name = name;
            this.pathOptions = pathOptions;
            this.routeSegments = [];
            this.selectedRouteSegmentIndex = -1;
            this.currentRoutingType = Common.RoutingType.hike;
            this.enabled = false;
            this.addDataToStack(this.getData());
            this.showKmMarkers = false;
            this.kmMarkersGroup = L.layerGroup([]);
            this.isRoutingPerPoint = localStorageService.get(DrawingRoute.IS_ROUTING_PER_POINT_KEY) ? true : false;
            this.map.addLayer(this.kmMarkersGroup);
            this.routePointIcon = IconsService.createMarkerIconWithColor(this.getColor());
            this.routePointIconStart = IconsService.createStartIcon();
            this.routePointIconEnd = IconsService.createEndIcon();
            this.state = DrawingState.inactive;

            this.hoverPolyline = L.polyline([]);
            this.hoverMarker = L.marker(this.map.getCenter(), { clickable: false, icon: this.routePointIcon } as L.MarkerOptions);
            this.setHoverLayersStyle();
            this.createMiddleMarker();
            this.setHoverState(HoverState.none);
            this.addPolylines(); // inactive state has the polylines.

            this.map.on("mousemove", this.onMouseMove, this);

            this.map.on("click", (e: L.LeafletMouseEvent) => {
                if (this.isEnabled()) {
                    var snappingResponse = this.snappingService.snapTo(e.latlng);
                    this.addPoint(snappingResponse.latlng, this.currentRoutingType).then(() => {
                        this.updateDataLayer();
                    });
                }
            });
        }

        public enable = (enable: boolean) => {
            this.enabled = enable;
            if (this.enabled === false) {
                this.setHoverState(HoverState.none);
            }
        }

        public clear = () => {
            this.internalClear();
            this.updateDataLayer();
        }

        public getRoutingType = (): string => {
            return this.currentRoutingType;
        }

        public setRoutingType = (routingType: string) => {
            this.currentRoutingType = routingType;
            if (this.isRoutingPerPoint) {
                return;
            }
            for (let segment of this.routeSegments) {
                segment.routingType = routingType;
            }
            this.reroute();
        }

        public reroute = (): angular.IPromise<void> => {
            var data = this.getData();
            this.internalClear();
            var promises = [];
            for (let segmentData of data.segments) {
                promises.push(this.addPoint(segmentData.routePoint, segmentData.routingType));
            }
            return this.$q.all(promises).then(() => this.updateDataLayer());
        }

        private createMiddleMarker = () => {
            this.middleMarker = L.marker(this.map.getCenter(), { clickable: true, draggable: true, icon: IconsService.createHoverIcon(this.getColor()), opacity: 0.0 } as L.MarkerOptions);
            this.middleMarker.on("click", () => {
                this.onMiddleMarkerClick();
            });

            this.middleMarker.on("dragstart", () => {
                this.setHoverState(HoverState.dragging);
                var snappingResponse = this.snapToRoute(this.middleMarker.getLatLng());
                this.selectedRouteSegmentIndex = _.findIndex(this.routeSegments, (segment) => segment.polyline === snappingResponse.polyline);
                var latlngzs = [this.getLatLngZFromLatLng(this.routeSegments[this.selectedRouteSegmentIndex - 1].routePoint.getLatLng()),
                    this.getLatLngZFromLatLng(snappingResponse.latlng)];
                var newSegment = this.createRouteSegment(snappingResponse.latlng, latlngzs, this.currentRoutingType);
                this.routeSegments.splice(this.selectedRouteSegmentIndex, 0, newSegment);
            });

            this.middleMarker.on("drag", () => {
                if (this.selectedRouteSegmentIndex === -1) {
                    return;
                }
                var snappingResponse = this.snappingService.snapTo(this.middleMarker.getLatLng());
                this.middleMarker.setLatLng(snappingResponse.latlng);
                this.routeSegments[this.selectedRouteSegmentIndex + 1].polyline.setLatLngs([snappingResponse.latlng, this.routeSegments[this.selectedRouteSegmentIndex + 1].routePoint.getLatLng()]);
                this.routeSegments[this.selectedRouteSegmentIndex].polyline.setLatLngs([this.routeSegments[this.selectedRouteSegmentIndex - 1].routePoint.getLatLng(), snappingResponse.latlng]);
            });

            this.middleMarker.on("dragend", () => {
                var snappingResponse = this.snappingService.snapTo(this.middleMarker.getLatLng());
                this.routeSegments[this.selectedRouteSegmentIndex].routePoint = this.createMarker(snappingResponse.latlng);
                this.routeSegments[this.selectedRouteSegmentIndex].routePointLatlng = snappingResponse.latlng;
                var tasks = [];
                tasks.push(this.runRouting(this.selectedRouteSegmentIndex - 1, this.selectedRouteSegmentIndex));
                tasks.push(this.runRouting(this.selectedRouteSegmentIndex, this.selectedRouteSegmentIndex + 1));
                this.selectedRouteSegmentIndex = -1;
                this.setHoverState(HoverState.none);
                this.$q.all(tasks).then(() => this.updateDataLayer());
            });
        }

        private createRouteSegment = (routePoint: L.LatLng, latlngzs: Common.LatLngZ[], routingType: string): IRouteSegment => {
            var routeSegment = {
                routePoint: (this.state === DrawingState.active && this.hoverState !== HoverState.dragging) ?
                    this.createMarker(routePoint) :
                    null,
                routePointLatlng: routePoint,
                polyline: L.polyline(latlngzs, this.pathOptions),
                latlngzs: latlngzs,
                routingType: routingType
            } as IRouteSegment;
            routeSegment.polyline.addTo(this.map);
            return routeSegment;
        }

        private addPoint = (latlng: L.LatLng, routingType: string): angular.IPromise<{}> => {
            this.routeSegments.push(this.createRouteSegment(latlng, [this.getLatLngZFromLatLng(latlng), this.getLatLngZFromLatLng(latlng)], routingType));
            this.updateStartAndEndMarkersIcons();
            if (this.routeSegments.length > 1) {
                var endPointSegmentIndex = this.routeSegments.length - 1;
                return this.runRouting(endPointSegmentIndex - 1, endPointSegmentIndex);
            } else if (this.routeSegments.length === 1) {
                return this.elevationProvider.updateHeights(this.routeSegments[0].latlngzs);
            }
            var deferred = this.$q.defer<{}>();
            deferred.resolve();

            return deferred.promise;

        }

        private createMarker = (latlng: L.LatLng): L.Marker => {
            var marker = L.marker(latlng, { draggable: true, clickable: true, riseOnHover: true } as L.MarkerOptions);
            marker.setIcon(this.routePointIcon);
            marker.addTo(this.map);
            this.setMarkerEvents(marker);
            return marker;
        }

        private setMarkerEvents = (marker: L.Marker) => {
            marker.on("dragstart", () => {
                this.setHoverState(HoverState.onMarker);
                this.dragPointStart(marker);
            });
            marker.on("drag", () => {
                this.dragPoint(marker);
            });
            marker.on("dragend", () => {
                this.dragPointEnd(marker);
                this.setHoverState(HoverState.none);
            });
            marker.on("mouseover", () => {
                if (this.hoverState !== HoverState.dragging) {
                    this.setHoverState(HoverState.onMarker);
                }
            });
            marker.on("mouseout", () => {
                if (this.hoverState !== HoverState.dragging) {
                    this.setHoverState(HoverState.none);
                }
            });
            marker.on("dblclick", (e: L.LeafletMouseEvent) => {
                this.removePoint(marker);
                this.setHoverState(HoverState.none);
                e.originalEvent.stopPropagation();
                return false;
            });
        }

        private onMiddleMarkerClick = () => {
            var snappingResponse = this.snapToRoute(this.middleMarker.getLatLng());
            if (snappingResponse.polyline == null) {
                return;
            }
            var segment = _.find(this.routeSegments, (segmentToFind) => segmentToFind.polyline === snappingResponse.polyline);
            if (segment == null) {
                return;
            }
            var segmentLatlngzs = segment.latlngzs;
            var indexOfSegment = this.routeSegments.indexOf(segment);
            var newSegmentLatlngs = segmentLatlngzs.splice(0, snappingResponse.beforeIndex + 1);
            var newRouteSegment = this.createRouteSegment(snappingResponse.latlng, newSegmentLatlngs, this.currentRoutingType);
            segment.polyline.setLatLngs(segmentLatlngzs);
            this.routeSegments.splice(indexOfSegment, 0, newRouteSegment);
        }

        private dragPointStart = (point: L.Marker) => {
            var pointSegmentToDrag = _.find(this.routeSegments, (pointSegmentTofind) => pointSegmentTofind.routePoint.getLatLng().equals(point.getLatLng()));
            this.selectedRouteSegmentIndex = pointSegmentToDrag == null ? -1 : this.routeSegments.indexOf(pointSegmentToDrag);
        }

        private dragPoint = (marker: L.Marker) => {
            if (this.selectedRouteSegmentIndex === -1) {
                return;
            }
            var snappingResponse = this.snappingService.snapTo(marker.getLatLng());
            marker.setLatLng(snappingResponse.latlng);
            this.routeSegments[this.selectedRouteSegmentIndex].routePointLatlng = snappingResponse.latlng;
            var segmentStartLatlng = this.selectedRouteSegmentIndex === 0 ? [snappingResponse.latlng] : [this.routeSegments[this.selectedRouteSegmentIndex - 1].routePoint.getLatLng(), snappingResponse.latlng];
            this.routeSegments[this.selectedRouteSegmentIndex].polyline.setLatLngs(segmentStartLatlng);
            if (this.selectedRouteSegmentIndex < this.routeSegments.length - 1) {
                this.routeSegments[this.selectedRouteSegmentIndex + 1].polyline.setLatLngs([snappingResponse.latlng, this.routeSegments[this.selectedRouteSegmentIndex + 1].routePoint.getLatLng()]);
            }
        }

        private dragPointEnd = (marker: L.Marker) => {
            if (this.selectedRouteSegmentIndex === -1) {
                return;
            }
            var snappingResponse = this.snappingService.snapTo(marker.getLatLng());
            marker.setLatLng(snappingResponse.latlng);
            this.routeSegments[this.selectedRouteSegmentIndex].routePointLatlng = snappingResponse.latlng;
            this.routeSegments[this.selectedRouteSegmentIndex].routingType = this.currentRoutingType;
            var tasks = [];
            if (this.selectedRouteSegmentIndex === 0) {
                this.routeSegments[0].latlngzs = [this.getLatLngZFromLatLng(snappingResponse.latlng), this.getLatLngZFromLatLng(snappingResponse.latlng)];
                tasks.push(this.elevationProvider.updateHeights(this.routeSegments[0].latlngzs));
            }
            else if (this.selectedRouteSegmentIndex > 0) {
                tasks.push(this.runRouting(this.selectedRouteSegmentIndex - 1, this.selectedRouteSegmentIndex));
            }
            if (this.selectedRouteSegmentIndex < this.routeSegments.length - 1) {
                tasks.push(this.runRouting(this.selectedRouteSegmentIndex, this.selectedRouteSegmentIndex + 1));
            }
            this.selectedRouteSegmentIndex = -1;
            this.$q.all(tasks).then(() => this.updateDataLayer());
        }

        private removePoint = (point: L.Marker) => {
            var pointSegmentToRemove = _.find(this.routeSegments, (pointSegmentTofind) => pointSegmentTofind.routePointLatlng.equals(point.getLatLng()));
            var pointSegmentIndex = this.routeSegments.indexOf(pointSegmentToRemove);
            this.removeSegmentByIndex(pointSegmentIndex);
            this.updateStartAndEndMarkersIcons();

            if (this.routeSegments.length > 0 && pointSegmentIndex === 0) {
                // first point is being removed
                this.routeSegments[0].latlngzs = [this.routeSegments[0].latlngzs[this.routeSegments[0].latlngzs.length - 1]];
                this.routeSegments[0].polyline.setLatLngs([this.routeSegments[0].routePointLatlng, this.routeSegments[0].routePointLatlng]);
                this.updateDataLayer();
            }
            else if (pointSegmentIndex !== 0 && pointSegmentIndex < this.routeSegments.length) {
                // middle point is being removed...
                this.runRouting(pointSegmentIndex - 1, pointSegmentIndex).then(() => this.updateDataLayer());
            }
            else {
                this.updateDataLayer();
            }
        }

        private runRouting = (startIndex: number, endIndex: number): angular.IPromise<any> => {
            var startSegment = this.routeSegments[startIndex];
            var endSegment = this.routeSegments[endIndex];
            var polyline = this.createLoadingSegmentIndicatorPolyline([startSegment.routePointLatlng, endSegment.routePointLatlng]);
            var promise = this.routerService.getRoute(startSegment.routePointLatlng, endSegment.routePointLatlng, endSegment.routingType);
            var deferred = this.$q.defer();
            promise.then((data) => {
                this.map.removeLayer(polyline);
                this.routeSegments[endIndex].latlngzs = data[data.length - 1].latlngzs;
                this.routeSegments[endIndex].polyline.setLatLngs(this.routeSegments[endIndex].latlngzs);
                deferred.resolve(this.elevationProvider.updateHeights(this.routeSegments[endIndex].latlngzs));
            });

            return deferred.promise;
        }

        private createLoadingSegmentIndicatorPolyline = (latlngs: L.LatLng[]): L.Polyline => {
            var polyline = L.polyline(latlngs, {
                dashArray: "10 10",
                className: "loading-segment-indicator",
                color: this.pathOptions.color,
                weight: this.pathOptions.weight,
                opacity: this.pathOptions.opacity
            } as L.PathOptions);
            this.map.addLayer(polyline);
            return polyline;
        }

        private setHoverState = (state: string) => {
            if (this.hoverState === state) {
                return;
            }
            this.hoverState = state;
            switch (this.hoverState) {
                case HoverState.none:
                case HoverState.onMarker:
                    this.map.removeLayer(this.hoverPolyline);
                    this.map.removeLayer(this.hoverMarker);
                    this.map.removeLayer(this.middleMarker);
                    break;
                case HoverState.onPolyline:
                case HoverState.dragging:
                    this.map.removeLayer(this.hoverPolyline);
                    this.map.removeLayer(this.hoverMarker);
                    this.map.addLayer(this.middleMarker);
                    break;
                case HoverState.addPoint:
                    this.map.addLayer(this.hoverPolyline);
                    this.map.addLayer(this.hoverMarker);
                    this.map.removeLayer(this.middleMarker);
                    break;
            }
        }

        private onMouseMove = (e: L.LeafletMouseEvent) => {
            if (this.state !== DrawingState.active ||
                this.hoverState === HoverState.onMarker ||
                this.hoverState === HoverState.dragging) {
                return;
            }
            let snapToResponse = this.snapToRoute(e.latlng);
            if (snapToResponse.polyline != null) {
                this.setHoverState(HoverState.onPolyline);
                this.middleMarker.setOpacity(1.0);
                this.middleMarker.setLatLng(snapToResponse.latlng);
                return;
            }

            this.middleMarker.setOpacity(0.0);
            if (this.isEnabled() === false) {
                return;
            }
            this.setHoverState(HoverState.addPoint);
            snapToResponse = this.snappingService.snapTo(e.latlng);
            this.hoverMarker.setLatLng(snapToResponse.latlng);
            var hoverStartPoint = this.routeSegments.length > 0 ?
                this.routeSegments[this.routeSegments.length - 1].routePointLatlng :
                snapToResponse.latlng;
            this.hoverPolyline.setLatLngs([hoverStartPoint, snapToResponse.latlng]);
        }

        public getData = (): Common.RouteData => {
            var pointsSegments = [] as Common.RouteSegmentData[];
            for (let pointSegment of this.routeSegments) {
                pointsSegments.push({
                    routePoint: pointSegment.routePointLatlng,
                    latlngzs: angular.copy(pointSegment.latlngzs),
                    routingType: pointSegment.routingType
                } as Common.RouteSegmentData);
            }
            return {
                name: this.name,
                segments: pointsSegments
            } as Common.RouteData;
        }

        public setData = (data: Common.RouteData) => {
            this.internalClear();
            data.name = this.name;
            var isRoutingPerPoint = this.isRoutingPerPoint;
            var firstRoutingType = null;
            for (let segment of data.segments) {
                if (firstRoutingType == null) {
                    firstRoutingType = segment.routingType;
                } else if (isRoutingPerPoint === false) {
                    isRoutingPerPoint = firstRoutingType !== segment.routingType;
                }
                let latlngzs = segment.latlngzs.length > 0 ? segment.latlngzs : [this.getLatLngZFromLatLng(segment.routePoint)];
                this.routeSegments.push(this.createRouteSegment(segment.routePoint, latlngzs, segment.routingType));
            }
            this.isRoutingPerPoint = isRoutingPerPoint;
            if (this.isRoutingPerPoint === false && firstRoutingType != null) {
                this.currentRoutingType = firstRoutingType;
            }
        }

        private internalClear = () => {
            for (let segmentIndex = this.routeSegments.length - 1; segmentIndex >= 0; segmentIndex--) {
                this.removeSegmentByIndex(segmentIndex);
            }
        }

        private removeSegmentByIndex = (segmentIndex: number) => {
            var segment = this.routeSegments[segmentIndex];
            this.destoryMarker(segment.routePoint);
            this.destroyPolyline(segment.polyline);
            this.routeSegments.splice(segmentIndex, 1);
        }

        private destoryMarker = (marker: L.Marker) => {
            if (marker == null) {
                return;
            }
            marker.off("click");
            marker.off("dragstart");
            marker.off("drag");
            marker.off("dragend");
            marker.off("mouseover");
            marker.off("mouseout");
            marker.off("dblclick");
            this.map.removeLayer(marker);
        }

        private destroyPolyline = (polyline: L.Polyline) => {
            this.map.removeLayer(polyline);
        }

        public changeStateTo = (targetState: string) => {
            if (targetState === this.state) {
                return;
            }
            switch (this.state) {
                case DrawingState.hidden:
                    this.addPolylines();
                    if (targetState === DrawingState.active) {
                        this.addMarkers();
                    }
                    break;
                case DrawingState.inactive:
                    if (targetState === DrawingState.active) {
                        this.addMarkers();
                    }
                    if (targetState === DrawingState.hidden) {
                        this.destroyPolylines();
                    }
                    break;
                case DrawingState.active:
                    this.destroyMarkers();
                    if (targetState === DrawingState.hidden) {
                        this.destroyPolylines();
                    }
                    break;
            }

            this.state = targetState;
            this.setHoverState(HoverState.none);
            this.toggleKmMarkers(false);
            this.updateStartAndEndMarkersIcons();
        }

        private addPolylines = () => {
            for (let segment of this.routeSegments) {
                this.map.addLayer(segment.polyline);
            }
        }

        private destroyPolylines = () => {
            for (let segment of this.routeSegments) {
                this.map.removeLayer(segment.polyline);
            }
        }

        private addMarkers = () => {
            for (let segment of this.routeSegments) {
                segment.routePoint = this.createMarker(segment.routePointLatlng);
            }
        }

        private destroyMarkers = () => {
            for (let segment of this.routeSegments) {
                this.destoryMarker(segment.routePoint);
                segment.routePoint = null;
            }
        }

        public destroy = () => {
            this.changeStateTo(DrawingState.hidden);
            this.destoryMarker(this.middleMarker);
            this.map.removeLayer(this.kmMarkersGroup);
            this.map.off("mousemove", this.onMouseMove, this);
        }

        private updateDataLayer = () => {
            var data = this.getData();
            this.addDataToStack(data);
            this.raiseRouteDataChanged();
            this.toggleKmMarkers(false);
        }

        private snapToRoute = (latlng: L.LatLng): ISnappingResponse => {
            var polylines = [];
            for (let segment of this.routeSegments) {
                polylines.push(segment.polyline);
            }
            return this.snappingService.snapTo(latlng, {
                sensitivity: 30,
                layers: L.layerGroup(polylines)
            } as ISnappingOptions);
        }

        private setHoverLayersStyle = () => {
            this.hoverPolyline.setStyle({ opacity: 0.5, color: this.pathOptions.color, weight: this.pathOptions.weight, dashArray: "10, 10" } as L.PolylineOptions);
            this.hoverMarker.setIcon(this.routePointIcon);
        }

        public setName = (name: string) => {
            if (this.name !== name) {
                this.name = name;
            }
        }

        public getPathOptions = (): L.PathOptions => {
            return this.pathOptions;
        }

        public setPathOptions = (pathOptions: L.PathOptions) => {
            this.pathOptions.color = pathOptions.color;
            this.routePointIcon = IconsService.createMarkerIconWithColor(this.getColor());
            this.middleMarker.setIcon(IconsService.createHoverIcon(this.getColor()));
            this.pathOptions.weight = pathOptions.weight;
            for (let segment of this.routeSegments) {
                if (segment.polyline != null) {
                    segment.polyline.setStyle(this.pathOptions);
                }
                if (segment.routePoint != null) {
                    segment.routePoint.setIcon(this.routePointIcon);
                }
            }
            this.setHoverLayersStyle();
            this.updateStartAndEndMarkersIcons();
            this.updateDataLayer();
        }

        private getLatLngZFromLatLng = (latlng: L.LatLng): Common.LatLngZ => {
            var latlngz = latlng as Common.LatLngZ;
            latlngz.z = 0;
            return latlngz;
        }

        public getRouteStatistics = (): IRouteStatistics => {
            var routeStatistics = {
                points: [] as IRouteStatisticsPoint[],
                length: 0,
                gain: 0,
                loss: 0
            } as IRouteStatistics;
            if (this.routeSegments.length <= 0) {
                return routeStatistics;
            }
            let previousPoint = this.routeSegments[0].latlngzs[0];;
            for (let segment of this.routeSegments) {
                for (let latlngz of segment.latlngzs) {
                    routeStatistics.length += previousPoint.distanceTo(latlngz);
                    let point = L.point((routeStatistics.length / 1000), latlngz.z) as IRouteStatisticsPoint;
                    point.latlng = latlngz;
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

        public isShowingKmMarkers = (): boolean => {
            return this.showKmMarkers;
        }

        public toggleKmMarkers = (showKmMarkers: boolean) => {
            this.showKmMarkers = showKmMarkers;
            this.kmMarkersGroup.clearLayers();
            if (this.showKmMarkers === false || this.routeSegments.length <= 0) {
                return;
            }
            var length = 0;
            var markerNumber = 0;
            var start = this.routeSegments[0].routePointLatlng;
            this.kmMarkersGroup.addLayer(this.createKmMarker(start, markerNumber));
            var previousPoint = start;
            for (let segment of this.routeSegments) {
                for (let latlngz of segment.latlngzs) {
                    length += previousPoint.distanceTo(latlngz);
                    previousPoint = latlngz;
                    if (length < (markerNumber + 1) * 1000) {
                        continue;
                    }
                    markerNumber++;
                    this.kmMarkersGroup.addLayer(this.createKmMarker(latlngz, markerNumber));
                }
            }
        }

        private createKmMarker = (latlng: L.LatLng, markerNumber: number): L.Marker => {
            return L.marker(latlng, {
                clickable: false,
                draggable: false,
                icon: IconsService.createKmMarkerIcon(markerNumber)
            } as L.MarkerOptions);
        }

        public setRouteDataChangedCallback = (callback: Function) => {
            this.datachangedCallback = callback;
        }

        private raiseRouteDataChanged = () => {
            if (this.datachangedCallback != null) {
                this.datachangedCallback();
            }
        }

        public getColor = () => {
            return this.pathOptions.color;
        }

        public getColorKeyValue = (): { key: string, value: string } => {
            return _.find(Common.Constants.COLORS, c => c.value === this.getColor());
        }

        public reverse = () => {
            for (let segmentIndex = 0; segmentIndex < this.routeSegments.length - 1; segmentIndex++) {
                var currentSegment = this.routeSegments[segmentIndex];
                var nextSegment = this.routeSegments[segmentIndex + 1];
                currentSegment.latlngzs = nextSegment.latlngzs.reverse();
                currentSegment.routingType = nextSegment.routingType;
                if (currentSegment.polyline != null && nextSegment.polyline != null) {
                    currentSegment.polyline.setLatLngs(nextSegment.polyline.getLatLngs().reverse());
                }
            }
            var lastSegment = this.routeSegments[this.routeSegments.length - 1];
            lastSegment.latlngzs = [lastSegment.latlngzs[lastSegment.latlngzs.length - 1]];
            if (lastSegment.polyline != null) {
                lastSegment.polyline.setLatLngs(lastSegment.latlngzs);
            }
            this.routeSegments.reverse();
            this.updateStartAndEndMarkersIcons();
            this.updateDataLayer();
        }

        private updateStartAndEndMarkersIcons = () => {
            if (this.routeSegments.length <= 0 || this.state !== DrawingState.active) {
                return;
            }
            this.routeSegments[this.routeSegments.length - 1].routePoint.setIcon(this.routePointIconEnd);
            this.routeSegments[0].routePoint.setIcon(this.routePointIconStart);
            for (var routeSegmentIndex = 1; routeSegmentIndex < this.routeSegments.length - 1; routeSegmentIndex++) {
                this.routeSegments[routeSegmentIndex].routePoint.setIcon(this.routePointIcon);
            }
        }

        public getIsRoutingPerPoint = (): boolean => {
            return this.isRoutingPerPoint;
        }

        public setIsRoutingPerPoint = (isRoutingPerPoint: boolean) => {
            this.isRoutingPerPoint = isRoutingPerPoint;
            this.localStorageService.set(DrawingRoute.IS_ROUTING_PER_POINT_KEY, this.isRoutingPerPoint);
        }
    }
}