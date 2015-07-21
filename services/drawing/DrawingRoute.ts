module IsraelHiking.Services.Drawing {
    interface IRouteSegment {
        routePoint: L.Marker;
        routePointLatlng: L.LatLng;
        polyline: L.Polyline;
    }

    interface IMiddleMarker {
        marker: L.Marker;
        parentRouteSegment: IRouteSegment;
    }

    export class DrawingRoute extends BaseDrawing<Common.RouteData> {
        private static MINIMAL_DISTANCE_BETWEEN_MARKERS = 100; // meter.

        private $q: angular.IQService;
        private routerFactory: Services.Routers.RouterFactory;
        private selectedPointSegmentIndex: number;
        private routingType: string;
        private hoverPolyline: L.Polyline;
        private enabled: boolean;
        private hoverEnabled: boolean;
        private routeSegments: IRouteSegment[];
        private middleMarkers: IMiddleMarker[];
        private middleIcon: L.Icon;
        private routePointIcon: L.Icon;

        constructor($q: angular.IQService,
            mapService: MapService,
            routerFactory: Services.Routers.RouterFactory,
            hashService: HashService,
            name: string) {
            super(mapService, hashService);
            this.$q = $q;
            this.routerFactory = routerFactory;
            this.name = name;
            this.hoverPolyline = L.polyline([], <L.PolylineOptions>{ opacity: 0.5, color: 'blue', weight: 4, dashArray: "10, 10" });
            this.routeSegments = [];
            this.selectedPointSegmentIndex = -1;
            this.routingType = Common.routingType.none;
            this.enabled = false;
            this.active = false;
            this.hoverEnabled = true;
            this.middleMarkers = [];
            this.hashService.addRoute(this.name);
            this.addDataToStack(this.getData());

            this.map.on("mousemove",(e: L.LeafletMouseEvent) => {
                if (this.isEnabled()) {
                    this.hover(e.latlng);
                }
            });

            this.map.on("click",(e: L.LeafletMouseEvent) => {
                if (this.isEnabled()) {
                    this.addPoint(e.latlng).then(() => {
                        this.updateDataLayer();
                    });
                }
            });

            this.middleIcon = new L.Icon.Default(<L.IconOptions> {
                iconUrl: L.Icon.Default.imagePath + "/marker-icon-middle.png",
                iconSize: new L.Point(17, 17),
                iconAnchor: new L.Point(9, 9),
                shadowSize: new L.Point(0, 0),
            });

            this.routePointIcon = new L.Icon.Default(<L.IconOptions> {
                iconSize: new L.Point(13, 21),
                iconAnchor: new L.Point(6, 21),
                iconUrl: L.Icon.Default.imagePath + "/marker-icon-small.png",
                shadowUrl: L.Icon.Default.imagePath + "/marker-shadow-small.png",
                shadowSize: new L.Point(21, 21),
            });
        }

        public enable = (enable: boolean) => {
            this.enabled = enable;
            if (this.enabled == false) {
                this.hoverPolyline.setLatLngs([]);
            }
        }

        public isEnabled = (): boolean => {
            return this.enabled && this.active;
        }

        public getRoutingType = (): string => {
            return this.routingType;
        }

        public changeRoutingType = (routeType: string): angular.IPromise<void> => {
            this.routingType = routeType;
            var data = this.getData();
            this.internalclear();
            var promises = [];
            for (var pointIndex = 0; pointIndex < data.segments.length; pointIndex++) {
                promises.push(this.addPoint(data.segments[pointIndex].routePoint));
            }
            return this.$q.all(promises).then(() => this.updateDataLayer());
        }

        public isRoutingEnabled = (): boolean => {
            return this.routingType != Common.routingType.none;
        }

        private createRouteSegment = (routePoint:L.LatLng, latlngs: L.LatLng[]): IRouteSegment => {
            var routeSegment = <IRouteSegment>{
                polyline: L.polyline(latlngs, <L.PolylineOptions>{ opacity: 0.5, color: "blue", weight: 4 }),
                routePoint: (this.active == false) ? null : this.createMarker(routePoint),
                routePointLatlng: routePoint,
            };
            routeSegment.polyline.addTo(this.map);
            return routeSegment;
        }

        private createRouteSegmentWithMarker = (latlngs: L.LatLng[], marker: L.Marker): IRouteSegment => {
            var routeSegment = <IRouteSegment>{
                polyline: L.polyline(latlngs, <L.PolylineOptions>{ opacity: 0.5, color: "blue", weight: 4 }),
                routePoint: marker,
                routePointLatlng: marker.getLatLng(),
            };
            routeSegment.polyline.addTo(this.map);
            return routeSegment;
        }


        private addPoint = (latlng: L.LatLng): angular.IPromise<void> => {
            this.routeSegments.push(this.createRouteSegment(latlng, [latlng]));
            if (this.routeSegments.length > 1) {
                var endPointSegmentIndex = this.routeSegments.length - 1;
                return this.runRouting(endPointSegmentIndex - 1, endPointSegmentIndex);
            }
            var deferred = this.$q.defer<void>();
            deferred.resolve();

            return deferred.promise;

        }

        private findDistanceToClosestMarker = (latlng: L.LatLng): number => {
            var latlngs = this.routeSegments[0].polyline.getLatLngs();
            var minDistance = latlng.distanceTo(latlngs[latlngs.length - 1]);
            for (var index = 0; index < this.routeSegments.length; index++) {
                latlngs = this.routeSegments[index].polyline.getLatLngs();
                var currentDistance = latlng.distanceTo(latlngs[latlngs.length - 1]);
                if (currentDistance < minDistance) {
                    minDistance = currentDistance;
                }
            }
            for (index = 0; index < this.middleMarkers.length; index++) {
                var currentDistance = latlng.distanceTo(this.middleMarkers[index].marker.getLatLng());
                if (currentDistance < minDistance) {
                    minDistance = currentDistance;
                }
            }

            return minDistance;
        }

        private createMarker = (latlng: L.LatLng): L.Marker => {
            var marker = L.marker(latlng, <L.MarkerOptions> { draggable: true, clickable: true, riseOnHover: true });
            marker.setIcon(this.routePointIcon);
            marker.addTo(this.map);
            this.setMarkerEvents(marker);
            return marker;
        }

        private setMarkerEvents = (marker: L.Marker) => {
            marker.on("click",(e: L.LeafletMouseEvent) => {
                var middleMarker = this.getMiddleMarker(marker);
                if (middleMarker != null) {
                    this.convertMiddleMarkerToPoint(middleMarker);
                    marker.setIcon(this.routePointIcon);
                    this.updateDataLayer();
                }
            });
            marker.on("dragstart",(e: L.LeafletMouseEvent) => {
                var middleMarker = this.getMiddleMarker(marker);
                if (middleMarker != null) {
                    this.convertMiddleMarkerToPoint(middleMarker);
                }
                this.hoverEnabled = false;
                this.dragPointStart(marker);
            });
            marker.on("drag",(e: L.LeafletMouseEvent) => {
                this.dragPoint(marker.getLatLng());
            });
            marker.on("dragend",(e: L.LeafletMouseEvent) => {
                this.dragPointEnd(marker.getLatLng());
                this.updateDataLayer();
                marker.setIcon(this.routePointIcon);
                marker.setOpacity(1.0)
                this.hoverEnabled = true;
            });
            marker.on("mouseover",(e: L.LeafletMouseEvent) => {
                this.hoverEnabled = false;
                var middleMarker = this.getMiddleMarker(marker);
                if (middleMarker != null) {
                    marker.setOpacity(0.5);
                }
            });
            marker.on("mouseout",(e: L.LeafletMouseEvent) => {
                this.hoverEnabled = this.selectedPointSegmentIndex == -1;
                var middleMarker = _.find(this.middleMarkers,(middleMarkerToFind) => middleMarkerToFind.marker.getLatLng().equals(marker.getLatLng()));
                if (middleMarker != null) {
                    marker.setOpacity(0);
                }
            });
            marker.on("dblclick",(e: L.LeafletMouseEvent) => {
                this.removePoint(marker);
                this.hoverEnabled = true;
                e.originalEvent.stopPropagation();
                return false;
            });
        }

        private createMiddleMarker = (latlng: L.LatLng): L.Marker => {
            var marker = this.createMarker(latlng);
            marker.setOpacity(0);
            marker.setIcon(this.middleIcon);
            return marker;
        }

        private getMiddleMarker = (marker: L.Marker) => {
            return _.find(this.middleMarkers,(middleMarkerToFind) => middleMarkerToFind.marker.getLatLng().equals(marker.getLatLng()));
        }

        private convertMiddleMarkerToPoint = (middleMarker: IMiddleMarker) => {
            var marker = middleMarker.marker;
            var segment = middleMarker.parentRouteSegment;
            var segmentLatlngs = segment.polyline.getLatLngs();
            var latlngInSegment = _.find(segmentLatlngs,(latlngToFind: L.LatLng) => latlngToFind.equals(marker.getLatLng()));
            var indexInSegment = segmentLatlngs.indexOf(latlngInSegment);
            var indexOfSegment = this.routeSegments.indexOf(segment);

            var newRouteSegment = this.createRouteSegmentWithMarker(segmentLatlngs.splice(0, indexInSegment + 1), marker);
            segmentLatlngs.splice(0, 0, newRouteSegment.routePointLatlng);
            segment.polyline.setLatLngs(segmentLatlngs);
            this.routeSegments.splice(indexOfSegment, 0, newRouteSegment);
            _.remove(this.middleMarkers,(middleMarkerToFind: IMiddleMarker) => middleMarkerToFind.marker.getLatLng().equals(marker.getLatLng()));
        }

        private dragPointStart = (point: L.Marker) => {
            var pointSegmentToDrag = _.find(this.routeSegments,(pointSegmentTofind) => pointSegmentTofind.routePoint.getLatLng().equals(point.getLatLng()));
            this.selectedPointSegmentIndex = pointSegmentToDrag == null ? -1 : this.routeSegments.indexOf(pointSegmentToDrag);
        }

        private dragPoint = (latlng: L.LatLng) => {
            if (this.selectedPointSegmentIndex == -1) {
                return;
            }
            this.routeSegments[this.selectedPointSegmentIndex].routePointLatlng = latlng;
            var segmentStartLatlng = this.selectedPointSegmentIndex == 0 ? [latlng] : [this.routeSegments[this.selectedPointSegmentIndex - 1].routePoint.getLatLng(), latlng];
            this.routeSegments[this.selectedPointSegmentIndex].polyline.setLatLngs(segmentStartLatlng);
            if (this.selectedPointSegmentIndex < this.routeSegments.length - 1) {
                this.routeSegments[this.selectedPointSegmentIndex + 1].polyline.setLatLngs([latlng, this.routeSegments[this.selectedPointSegmentIndex + 1].routePoint.getLatLng()]);
            }
        }

        private dragPointEnd = (latlng: L.LatLng) => {
            if (this.selectedPointSegmentIndex == -1) {
                return;
            }
            this.routeSegments[this.selectedPointSegmentIndex].routePointLatlng = latlng;
            if (this.selectedPointSegmentIndex > 0) {
                this.runRouting(this.selectedPointSegmentIndex - 1, this.selectedPointSegmentIndex);
            }
            if (this.selectedPointSegmentIndex < this.routeSegments.length - 1) {
                this.runRouting(this.selectedPointSegmentIndex, this.selectedPointSegmentIndex + 1);
            }
            this.selectedPointSegmentIndex = -1;
        }

        private removePoint = (point: L.Marker) => {
            var pointSegmentToRemove = _.find(this.routeSegments,(pointSegmentTofind) => pointSegmentTofind.routePointLatlng.equals(point.getLatLng()));
            var pointSegmentIndex = this.routeSegments.indexOf(pointSegmentToRemove);
            this.removeSegmentByIndex(pointSegmentIndex);

            if (this.routeSegments.length > 0 && pointSegmentIndex == 0) {
                // first point is being removed
                this.routeSegments[0].polyline.setLatLngs([this.routeSegments[0].routePointLatlng]);
                this.removeMiddleMarkerBySegment(this.routeSegments[0]);
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
            this.removeMiddleMarkerBySegment(endSegment);
            var router = this.routerFactory.create(this.routingType);
            var promise = router.getRoute(startSegment.routePointLatlng, endSegment.routePointLatlng);

            promise.then((data) => {
                this.routeSegments[endIndex].polyline.setLatLngs(data[data.length - 1].latlngs);
                if (this.active) {
                    this.addMiddleMarkersToSegment(this.routeSegments[endIndex]);
                }
            });

            return promise;
        }

        private addMiddleMarkersToSegment = (routeSegment: IRouteSegment) => {
            var latlngs = routeSegment.polyline.getLatLngs();
            for (var latlngIndex = 0; latlngIndex < latlngs.length; latlngIndex++) {
                var latlng = latlngs[latlngIndex];
                if (latlngIndex == latlngs.length - 1) {
                    // no need to add a middle marker where the route point is.
                    continue;
                }
                if (this.findDistanceToClosestMarker(latlng) <= DrawingRoute.MINIMAL_DISTANCE_BETWEEN_MARKERS) {
                    continue;
                }
                this.middleMarkers.push(<IMiddleMarker> {
                    parentRouteSegment: routeSegment,
                    marker: this.createMiddleMarker(latlng),
                });
            }
        }

        private hover = (latlng: L.LatLng) => {
            this.hoverPolyline.setLatLngs([]);
            if (this.routeSegments.length > 0 && this.hoverEnabled && this.isEnabled()) {
                var hoverStartPoint = this.routeSegments[this.routeSegments.length - 1].routePointLatlng;
                this.hoverPolyline.setLatLngs([hoverStartPoint, latlng]);
            }
        }

        public getData = (): Common.RouteData => {
            var pointsSegments = <Common.RouteSegmentData[]>[];
            for (var wayPointIndex = 0; wayPointIndex < this.routeSegments.length; wayPointIndex++) {
                var pointSegment = this.routeSegments[wayPointIndex];
                pointsSegments.push(<Common.RouteSegmentData> {
                    routePoint: pointSegment.routePointLatlng,
                    latlngs: angular.copy(pointSegment.polyline.getLatLngs()),
                });
            }
            return <Common.RouteData>{
                name: this.name,
                routingType: this.routingType,
                segments: pointsSegments
            };
        }

        public setData = (data: Common.RouteData) => {
            this.internalclear();
            data.name = this.name;
            for (var pointIndex = 0; pointIndex < data.segments.length; pointIndex++) {
                var segment = data.segments[pointIndex];
                var latlngs = segment.latlngs.length > 0 ? segment.latlngs : [segment.routePoint];
                this.routeSegments.push(this.createRouteSegment(segment.routePoint, latlngs));
            }
            this.routingType = data.routingType;
            this.hashService.updateRoute(this.getData());
        }

        private internalclear = () => {
            for (var segmentIndex = this.routeSegments.length - 1; segmentIndex >= 0; segmentIndex--) {
                this.removeSegmentByIndex(segmentIndex);
            }
        }

        private removeSegmentByIndex = (segmentIndex: number) => {
            var segment = this.routeSegments[segmentIndex];
            this.removeMiddleMarkerBySegment(segment);
            this.destoryMarker(segment.routePoint);
            this.map.removeLayer(segment.polyline);
            this.routeSegments.splice(segmentIndex, 1);
        }

        private removeMiddleMarkerBySegment = (segment: IRouteSegment) => {
            for (var middleMarkerIndex = this.middleMarkers.length - 1; middleMarkerIndex >= 0; middleMarkerIndex--) {
                var middleMarker = this.middleMarkers[middleMarkerIndex];
                if (middleMarker.parentRouteSegment == segment) {
                    this.destoryMarker(middleMarker.marker);
                    this.middleMarkers.splice(middleMarkerIndex, 1);
                }
            }
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

        public activate = () => {
            this.active = true;
            this.enabled = true;
            for (var segmementIndex = 0; segmementIndex < this.routeSegments.length; segmementIndex++) {
                var segment = this.routeSegments[segmementIndex];
                segment.routePoint = this.createMarker(segment.routePointLatlng);
                this.addMiddleMarkersToSegment(segment);
            }
            this.map.addLayer(this.hoverPolyline);
        }

        public deactivate = () => {
            this.active = false;
            this.enabled = false;
            for (var segmentIndex = 0; segmentIndex < this.routeSegments.length; segmentIndex++) {
                var segment = this.routeSegments[segmentIndex];
                this.removeMiddleMarkerBySegment(segment);
                this.destoryMarker(segment.routePoint);
                segment.routePoint = null;
            }
            this.map.removeLayer(this.hoverPolyline);
        }

        public destroy = () => {
            if (this.active) {
                this.deactivate();
            }
            for (var segmementIndex = 0; segmementIndex < this.routeSegments.length; segmementIndex++) {
                var segment = this.routeSegments[segmementIndex];
                this.map.removeLayer(segment.polyline);
            }
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
    }
}