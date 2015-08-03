module IsraelHiking.Services.Drawing {
    interface IRouteSegment {
        routePoint: L.Marker;
        routePointLatlng: L.LatLng;
        polyline: L.Polyline;
        routingType: string;
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

        private $q: angular.IQService;
        private routerFactory: Services.Routers.RouterFactory;
        private snappingService: SnappingService;
        private selectedRouteSegmentIndex: number;
        private currentRoutingType: string;
        private hoverPolyline: L.Polyline;
        private hoverMarker: L.Marker;
        private enabled: boolean;
        private routeSegments: IRouteSegment[];
        private middleMarker: L.Marker;
        private middleIcon: L.Icon;
        private routePointIcon: L.Icon;
        private hoverState: string;

        constructor($q: angular.IQService,
            mapService: MapService,
            routerFactory: Services.Routers.RouterFactory,
            hashService: HashService,
            snappingService: SnappingService,
            name: string) {
            super(mapService, hashService);
            this.$q = $q;
            this.routerFactory = routerFactory;
            this.snappingService = snappingService;
            this.name = name;
            this.routeSegments = [];
            this.selectedRouteSegmentIndex = -1;
            this.currentRoutingType = Common.RoutingType.hike;
            this.enabled = false;
            this.hashService.addRoute(this.name);
            this.addDataToStack(this.getData());

            this.routePointIcon = new L.Icon.Default(<L.IconOptions> {
                iconSize: new L.Point(13, 21),
                iconAnchor: new L.Point(6, 21),
                iconUrl: L.Icon.Default.imagePath + "/marker-icon-small.png",
                shadowUrl: L.Icon.Default.imagePath + "/marker-shadow-small.png",
                shadowSize: new L.Point(21, 21),
            });

            this.hoverPolyline = L.polyline([], <L.PolylineOptions>{ opacity: 0.5, color: 'blue', weight: 4, dashArray: "10, 10" });
            this.hoverMarker = L.marker(this.map.getCenter(), <L.MarkerOptions> { clickable: false, icon: this.routePointIcon });
            this.createMiddleMarker();
            this.setHoverState(HoverState.none);
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
            if (this.enabled == false) {
                this.setHoverState(HoverState.none);
            }
        }

        public isEnabled = (): boolean => {
            return this.enabled && this.state == DrawingState.active;
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
        }

        public reroute = (): angular.IPromise<void> => {
            var data = this.getData();
            this.internalClear();
            var promises = [];
            for (var pointIndex = 0; pointIndex < data.segments.length; pointIndex++) {
                var segmentData = data.segments[pointIndex];
                promises.push(this.addPoint(segmentData.routePoint, segmentData.routingType));
            }
            return this.$q.all(promises).then(() => this.updateDataLayer());
        }

        private createMiddleMarker = () => {
            this.middleIcon = new L.Icon.Default(<L.IconOptions> {
                iconUrl: L.Icon.Default.imagePath + "/marker-icon-middle.png",
                iconSize: new L.Point(17, 17),
                iconAnchor: new L.Point(9, 9),
                shadowSize: new L.Point(0, 0),
            });

            this.middleMarker = L.marker(this.map.getCenter(), <L.MarkerOptions> { clickable: true, draggable: true, icon: this.middleIcon, opacity: 0.0 });
            this.middleMarker.on("click", (e: L.LeafletMouseEvent) => {
                this.convertMiddleMarkerToPoint();
            });

            this.middleMarker.on("dragstart", (e: L.LeafletMouseEvent) => {
                var snappingResponse = this.snapToRoute(this.middleMarker.getLatLng());
                this.selectedRouteSegmentIndex = _.findIndex(this.routeSegments, (segment) => segment.polyline == snappingResponse.polyline);
                var newSegment = this.createRouteSegment(snappingResponse.latlng, [this.routeSegments[this.selectedRouteSegmentIndex - 1].routePoint.getLatLng(), snappingResponse.latlng], this.currentRoutingType);
                this.routeSegments.splice(this.selectedRouteSegmentIndex, 0, newSegment);
                this.hoverState = HoverState.dragging;
            });

            this.middleMarker.on("drag", (e: L.LeafletMouseEvent) => {
                if (this.selectedRouteSegmentIndex == -1) {
                    return;
                }
                var snappingResponse = this.snappingService.snapTo(this.middleMarker.getLatLng());
                this.middleMarker.setLatLng(snappingResponse.latlng);
                this.routeSegments[this.selectedRouteSegmentIndex + 1].polyline.setLatLngs([snappingResponse.latlng, this.routeSegments[this.selectedRouteSegmentIndex + 1].routePoint.getLatLng()]);
                this.routeSegments[this.selectedRouteSegmentIndex].polyline.setLatLngs([this.routeSegments[this.selectedRouteSegmentIndex - 1].routePoint.getLatLng(), snappingResponse.latlng]);
            });

            this.middleMarker.on("dragend", (e: L.LeafletMouseEvent) => {
                var snappingResponse = this.snappingService.snapTo(this.middleMarker.getLatLng());
                this.routeSegments[this.selectedRouteSegmentIndex].routePoint = this.createMarker(snappingResponse.latlng);
                this.routeSegments[this.selectedRouteSegmentIndex].routePointLatlng = snappingResponse.latlng;
                this.runRouting(this.selectedRouteSegmentIndex - 1, this.selectedRouteSegmentIndex);
                this.runRouting(this.selectedRouteSegmentIndex, this.selectedRouteSegmentIndex + 1);
                this.selectedRouteSegmentIndex = -1;
                this.setHoverState(HoverState.none);
                this.updateDataLayer();
            });
        }

        private createRouteSegment = (routePoint: L.LatLng, latlngs: L.LatLng[], routingType: string): IRouteSegment => {
            var routeSegment = <IRouteSegment>{
                polyline: L.polyline(latlngs, <L.PolylineOptions>{ opacity: 0.5, color: "blue", weight: 4 }),
                routePoint: (this.state == DrawingState.active && this.hoverState != HoverState.dragging) ?
                    this.createMarker(routePoint) :
                    null,
                routePointLatlng: routePoint,
                routingType: routingType,
            };
            routeSegment.polyline.addTo(this.map);
            return routeSegment;
        }

        private addPoint = (latlng: L.LatLng, routingType: string): angular.IPromise<void> => {
            this.routeSegments.push(this.createRouteSegment(latlng, [latlng], routingType));
            if (this.routeSegments.length > 1) {
                var endPointSegmentIndex = this.routeSegments.length - 1;
                return this.runRouting(endPointSegmentIndex - 1, endPointSegmentIndex);
            }
            var deferred = this.$q.defer<void>();
            deferred.resolve();

            return deferred.promise;

        }

        private createMarker = (latlng: L.LatLng): L.Marker => {
            var marker = L.marker(latlng, <L.MarkerOptions> { draggable: true, clickable: true, riseOnHover: true });
            marker.setIcon(this.routePointIcon);
            marker.addTo(this.map);
            this.setMarkerEvents(marker);
            return marker;
        }

        private setMarkerEvents = (marker: L.Marker) => {
            marker.on("dragstart", (e: L.LeafletMouseEvent) => {
                this.setHoverState(HoverState.onMarker);
                this.dragPointStart(marker);
            });
            marker.on("drag", (e: L.LeafletMouseEvent) => {
                this.dragPoint(marker);
            });
            marker.on("dragend", (e: L.LeafletMouseEvent) => {
                this.dragPointEnd(marker);
                this.updateDataLayer();
                this.setHoverState(HoverState.none);
            });
            marker.on("mouseover", (e: L.LeafletMouseEvent) => {
                this.setHoverState(HoverState.onMarker);
            });
            marker.on("mouseout", (e: L.LeafletMouseEvent) => {
                this.setHoverState(HoverState.none);
            });
            marker.on("dblclick", (e: L.LeafletMouseEvent) => {
                this.removePoint(marker);
                this.setHoverState(HoverState.none);
                e.originalEvent.stopPropagation();
                return false;
            });
        }

        private convertMiddleMarkerToPoint = () => {
            var snappingResponse = this.snapToRoute(this.middleMarker.getLatLng());
            if (snappingResponse.polyline == null) {
                return;
            }
            var segment = _.find(this.routeSegments, (segment) => segment.polyline == snappingResponse.polyline);
            if (segment == null) {
                return;
            }
            var segmentLatlngs = segment.polyline.getLatLngs();
            var indexOfSegment = this.routeSegments.indexOf(segment);
            var newSegmentLatlngs = segmentLatlngs.splice(0, snappingResponse.beforeIndex + 1);
            newSegmentLatlngs.push(snappingResponse.latlng);
            var newRouteSegment = this.createRouteSegment(snappingResponse.latlng, newSegmentLatlngs, this.currentRoutingType);
            segmentLatlngs.splice(0, 0, newRouteSegment.routePointLatlng);
            segment.polyline.setLatLngs(segmentLatlngs);
            this.routeSegments.splice(indexOfSegment, 0, newRouteSegment);
        }

        private dragPointStart = (point: L.Marker) => {
            var pointSegmentToDrag = _.find(this.routeSegments, (pointSegmentTofind) => pointSegmentTofind.routePoint.getLatLng().equals(point.getLatLng()));
            this.selectedRouteSegmentIndex = pointSegmentToDrag == null ? -1 : this.routeSegments.indexOf(pointSegmentToDrag);
        }

        private dragPoint = (marker: L.Marker) => {
            if (this.selectedRouteSegmentIndex == -1) {
                return;
            }
            var snappingResponse = this.snappingService.snapTo(marker.getLatLng());
            marker.setLatLng(snappingResponse.latlng);
            this.routeSegments[this.selectedRouteSegmentIndex].routePointLatlng = snappingResponse.latlng;
            var segmentStartLatlng = this.selectedRouteSegmentIndex == 0 ? [snappingResponse.latlng] : [this.routeSegments[this.selectedRouteSegmentIndex - 1].routePoint.getLatLng(), snappingResponse.latlng];
            this.routeSegments[this.selectedRouteSegmentIndex].polyline.setLatLngs(segmentStartLatlng);
            if (this.selectedRouteSegmentIndex < this.routeSegments.length - 1) {
                this.routeSegments[this.selectedRouteSegmentIndex + 1].polyline.setLatLngs([snappingResponse.latlng, this.routeSegments[this.selectedRouteSegmentIndex + 1].routePoint.getLatLng()]);
            }
        }

        private dragPointEnd = (marker: L.Marker) => {
            if (this.selectedRouteSegmentIndex == -1) {
                return;
            }
            var snappingResponse = this.snappingService.snapTo(marker.getLatLng());
            marker.setLatLng(snappingResponse.latlng);
            this.routeSegments[this.selectedRouteSegmentIndex].routePointLatlng = snappingResponse.latlng;
            this.routeSegments[this.selectedRouteSegmentIndex].routingType = this.currentRoutingType;
            if (this.selectedRouteSegmentIndex > 0) {
                this.runRouting(this.selectedRouteSegmentIndex - 1, this.selectedRouteSegmentIndex);
            }
            if (this.selectedRouteSegmentIndex < this.routeSegments.length - 1) {
                this.runRouting(this.selectedRouteSegmentIndex, this.selectedRouteSegmentIndex + 1);
            }
            this.selectedRouteSegmentIndex = -1;
        }

        private removePoint = (point: L.Marker) => {
            var pointSegmentToRemove = _.find(this.routeSegments, (pointSegmentTofind) => pointSegmentTofind.routePointLatlng.equals(point.getLatLng()));
            var pointSegmentIndex = this.routeSegments.indexOf(pointSegmentToRemove);
            this.removeSegmentByIndex(pointSegmentIndex);

            if (this.routeSegments.length > 0 && pointSegmentIndex == 0) {
                // first point is being removed
                this.routeSegments[0].polyline.setLatLngs([this.routeSegments[0].routePointLatlng]);
                this.updateDataLayer();
            }
            else if (pointSegmentIndex != 0 && pointSegmentIndex < this.routeSegments.length) {
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
            var router = this.routerFactory.create(endSegment.routingType);
            var promise = router.getRoute(startSegment.routePointLatlng, endSegment.routePointLatlng);

            promise.then((data) => {
                this.routeSegments[endIndex].polyline.setLatLngs(data[data.length - 1].latlngs);
            });

            return promise;
        }

        private setHoverState = (state: string) => {
            if (this.hoverState == state) {
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
            if (this.state != DrawingState.active || 
                this.hoverState == HoverState.onMarker ||
                this.hoverState == HoverState.dragging) {
                return;
            }
            var snapToResponse = this.snapToRoute(e.latlng);
            if (snapToResponse.polyline != null) {
                this.setHoverState(HoverState.onPolyline);
                this.middleMarker.setOpacity(1.0);
                this.middleMarker.setLatLng(snapToResponse.latlng);
                return;
            }

            this.middleMarker.setOpacity(0.0);
            if (this.isEnabled() == false) {
                return;
            }
            this.setHoverState(HoverState.addPoint);
            var snapToResponse = this.snappingService.snapTo(e.latlng);
            this.hoverMarker.setLatLng(snapToResponse.latlng);
            var hoverStartPoint = this.routeSegments.length > 0 ?
                this.routeSegments[this.routeSegments.length - 1].routePointLatlng :
                snapToResponse.latlng;
            this.hoverPolyline.setLatLngs([hoverStartPoint, snapToResponse.latlng]);
        }

        public getData = (): Common.RouteData => {
            var pointsSegments = <Common.RouteSegmentData[]>[];
            for (var wayPointIndex = 0; wayPointIndex < this.routeSegments.length; wayPointIndex++) {
                var pointSegment = this.routeSegments[wayPointIndex];
                pointsSegments.push(<Common.RouteSegmentData> {
                    routePoint: pointSegment.routePointLatlng,
                    latlngs: angular.copy(pointSegment.polyline.getLatLngs()),
                    routingType: pointSegment.routingType,
                });
            }
            return <Common.RouteData>{
                name: this.name,
                segments: pointsSegments
            };
        }

        public setData = (data: Common.RouteData) => {
            this.internalClear();
            data.name = this.name;
            for (var pointIndex = 0; pointIndex < data.segments.length; pointIndex++) {
                var segment = data.segments[pointIndex];
                var latlngs = segment.latlngs.length > 0 ? segment.latlngs : [segment.routePoint];
                this.routeSegments.push(this.createRouteSegment(segment.routePoint, latlngs, segment.routingType));
            }
            this.hashService.updateRoute(this.getData());
        }

        private internalClear = () => {
            for (var segmentIndex = this.routeSegments.length - 1; segmentIndex >= 0; segmentIndex--) {
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

        public activate = () => {
            var needToAddPolylines = this.state == DrawingState.hidden;
            this.state = DrawingState.active;
            for (var segmementIndex = 0; segmementIndex < this.routeSegments.length; segmementIndex++) {
                var segment = this.routeSegments[segmementIndex];
                segment.routePoint = this.createMarker(segment.routePointLatlng);
                if (needToAddPolylines) {
                    this.map.addLayer(segment.polyline);
                }
            }
            this.setHoverState(HoverState.none);
        }

        public deactivate = () => {
            this.state = DrawingState.inactive;
            this.enabled = false;
            for (var segmentIndex = 0; segmentIndex < this.routeSegments.length; segmentIndex++) {
                var segment = this.routeSegments[segmentIndex];
                this.destoryMarker(segment.routePoint);
                segment.routePoint = null;
            }
            this.setHoverState(HoverState.none);
        }

        public destroy = () => {
            if (this.state == DrawingState.active) {
                this.deactivate();
            }
            for (var segmementIndex = 0; segmementIndex < this.routeSegments.length; segmementIndex++) {
                var segment = this.routeSegments[segmementIndex];
                this.destroyPolyline(segment.polyline);
            }
            this.destoryMarker(this.middleMarker);
            this.map.off("mousemove", this.onMouseMove, this);
        }

        private updateDataLayer = () => {
            var data = this.getData();
            this.hashService.updateRoute(data);
            this.addDataToStack(data);
        }

        protected postUndoHook = () => {
            var data = this.getData();
            this.hashService.updateRoute(data);
        }

        public hide = () => {
            this.state = DrawingState.hidden;
            for (var segmementIndex = 0; segmementIndex < this.routeSegments.length; segmementIndex++) {
                var segment = this.routeSegments[segmementIndex];
                this.map.removeLayer(segment.polyline);
                this.map.removeLayer(segment.routePoint);
            }
        }
        public show = () => {
            this.state = DrawingState.active;
            for (var segmementIndex = 0; segmementIndex < this.routeSegments.length; segmementIndex++) {
                var segment = this.routeSegments[segmementIndex];
                this.map.addLayer(segment.polyline);
                this.map.addLayer(segment.routePoint);
            }
        }

        private snapToRoute = (latlng: L.LatLng): ISnappingResponse => {
            var polylines = [];
            for (var segmentIndex = 0; segmentIndex < this.routeSegments.length; segmentIndex++) {
                polylines.push(this.routeSegments[segmentIndex].polyline);
            }
            return this.snappingService.snapTo(latlng, <ISnappingOptions> {
                sensitivity: 30,
                layers: L.layerGroup(polylines)
            });
        }
    }
}