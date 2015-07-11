module IsraelHiking.Services {
    interface IRouteSegment {
        routePoint: L.Marker;
        polyline: L.Polyline;
    }

    interface IMiddleMarker {
        marker: L.Marker;
        parentRouteSegment: IRouteSegment;
    }


    export class DrawingRouteService extends ObjectWithMap {
        private static MINIMAL_DISTANCE_BETWEEN_MARKERS = 100; // meter.
        private static MINIMAL_TIME_BETWEEN_DRANGEND_AND_CLICK = 100; // milliseconds.

        private $q: angular.IQService;
        private routerFactory: Services.Routers.RouterFactory;
        private selectedPointSegmentIndex: number;
        private routingType: Common.routingType
        private hoverPolyline: L.Polyline;
        private enabled: boolean;
        private hoverEnabled: boolean;
        private routeSegments: IRouteSegment[];
        private middleMarkers: IMiddleMarker[];
        private middleIcon: L.Icon;
        private dragendEventTime: number; // this is used in order to overcome a bug in leaflet where click is fired right after drangend.

        public eventHelper: Common.EventHelper<IDataChangedEventArgs>;

        constructor($q: angular.IQService,
            mapService: MapService,
            routerFactory: Services.Routers.RouterFactory) {
            super(mapService);
            this.$q = $q;
            this.routerFactory = routerFactory;
            this.hoverPolyline = L.polyline([], <L.PolylineOptions>{ opacity: 0.5, color: 'blue', weight: 4, dashArray: "10, 10" });

            this.routeSegments = [];
            this.selectedPointSegmentIndex = -1;
            this.routingType = Common.routingType.none;
            this.enabled = false;
            this.hoverEnabled = true;
            this.middleMarkers = [];
            this.dragendEventTime = Date.now();
            this.eventHelper = new Common.EventHelper<IDataChangedEventArgs>();
            this.hoverPolyline.addTo(this.map);

            this.map.on("mousemove",(e: L.LeafletMouseEvent) => {
                if (this.enabled) {
                    this.hover(e.latlng);
                }
            });

            this.map.on("click",(e: L.LeafletMouseEvent) => {
                if (this.isEnabled()) {
                    this.addPoint(e.latlng).then(() => {
                        this.eventHelper.raiseEvent({ applyToScope: true });
                    });
                }
            });

            this.middleIcon = new L.Icon.Default(<L.IconOptions> {
                iconUrl: L.Icon.Default.imagePath + "/marker-icon-middle.png",
                iconSize: new L.Point(17, 17),
                iconAnchor: new L.Point(9, 9),
                shadowSize: new L.Point(0, 0),
            });
        }

        public enable = (enable: boolean) => {
            this.enabled = enable;
            if (this.enabled == false) {
                this.hoverPolyline.setLatLngs([]);
            }
        }

        public isEnabled = (): boolean => {
            return this.enabled;
        }

        public getRoutingType = (): Common.routingType => {
            return this.routingType;
        }

        public changeRoutingType = (routeType: Common.routingType) => {
            this.routingType = routeType;
            var data = this.getData();
            this.internalclear();
            var promises = [];
            for (var pointIndex = 0; pointIndex < data.segments.length; pointIndex++) {
                promises.push(this.addPoint(data.segments[pointIndex].routePoint));
            }
            this.$q.all(promises).then(() => this.eventHelper.raiseEvent({ applyToScope: true }));
        }

        public isRoutingEnabled = (): boolean => {
            return this.routingType != Common.routingType.none;
        }

        private createRouteSegment = (latlngs: L.LatLng[], marker = null): IRouteSegment => {
            var routeSegment = <IRouteSegment>{
                polyline: L.polyline(latlngs, <L.PolylineOptions>{ opacity: 0.5, color: "blue", weight: 4 }),
                routePoint: marker || this.createMarker(latlngs[latlngs.length - 1]),
            };
            routeSegment.polyline.addTo(this.map);
            return routeSegment;
        }


        private addPoint = (latlng: L.LatLng): angular.IPromise<void> => {
            this.routeSegments.push(this.createRouteSegment([latlng]));
            if (this.routeSegments.length > 1) {
                var endPointSegmentIndex = this.routeSegments.length - 1;
                return this.runRouting(endPointSegmentIndex - 1, endPointSegmentIndex);
            }
            var deferred = this.$q.defer<void>();
            deferred.resolve();

            return deferred.promise;

        }

        private findDistanceToClosestMarker = (latlng: L.LatLng): number => {
            var minDistance = latlng.distanceTo(this.routeSegments[0].routePoint.getLatLng());
            for (var index = 0; index < this.routeSegments.length; index++) {
                var currentDistance = latlng.distanceTo(this.routeSegments[index].routePoint.getLatLng());
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
            marker.addTo(this.map);
            this.setMarkerEvents(marker);
            return marker;
        }

        private setMarkerEvents = (marker: L.Marker) => {
            marker.on("click",(e: L.LeafletMouseEvent) => {
                if (Date.now() - this.dragendEventTime < DrawingRouteService.MINIMAL_TIME_BETWEEN_DRANGEND_AND_CLICK) {
                    return;
                }
                var middleMarker = this.getMiddleMarker(marker);
                if (middleMarker != null) {
                    this.convertMiddleMarkerToPoint(middleMarker);
                } else {
                    this.removePoint(marker);
                    this.hoverEnabled = true;
                }
                this.eventHelper.raiseEvent({ applyToScope: true });
            });
            marker.on("dragstart",(e: L.LeafletMouseEvent) => {
                var middleMarker = this.getMiddleMarker(marker);
                if (middleMarker != null) {
                    this.convertMiddleMarkerToPoint(middleMarker);
                }
                this.dragPointStart(marker);
                this.eventHelper.raiseEvent({ applyToScope: true });
            });
            marker.on("drag",(e: L.LeafletMouseEvent) => {
                this.dragPoint(marker.getLatLng());
            });
            marker.on("dragend",(e: L.LeafletMouseEvent) => {
                this.dragPointEnd(marker.getLatLng());
                this.eventHelper.raiseEvent({ applyToScope: true });
                this.dragendEventTime = Date.now();

            });
            marker.on("mouseover",(e: L.LeafletMouseEvent) => {
                this.hoverEnabled = false;
                var middleMarker = this.getMiddleMarker(marker);
                if (middleMarker != null) {
                    marker.setOpacity(1.0);
                }
            });
            marker.on("mouseout",(e: L.LeafletMouseEvent) => {
                this.hoverEnabled = true;
                var middleMarker = _.find(this.middleMarkers,(middleMarkerToFind) => middleMarkerToFind.marker.getLatLng().equals(marker.getLatLng()));
                if (middleMarker != null) {
                    marker.setOpacity(0);
                }
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

            var newRouteSegment = this.createRouteSegment(segmentLatlngs.splice(0, indexInSegment + 1), marker);
            segmentLatlngs.splice(0, 0, newRouteSegment.routePoint.getLatLng());
            segment.polyline.setLatLngs(segmentLatlngs);
            this.routeSegments.splice(indexOfSegment, 0, newRouteSegment);
            _.remove(this.middleMarkers,(middleMarkerToFind: IMiddleMarker) => middleMarkerToFind.marker.getLatLng().equals(marker.getLatLng()));
            marker.setIcon(new L.Icon.Default());
        }

        private dragPointStart = (point: L.Marker) => {
            var pointSegmentToDrag = _.find(this.routeSegments,(pointSegmentTofind) => pointSegmentTofind.routePoint.getLatLng().equals(point.getLatLng()));
            this.selectedPointSegmentIndex = pointSegmentToDrag == null ? -1 : this.routeSegments.indexOf(pointSegmentToDrag);
        }

        private dragPoint = (latlng: L.LatLng) => {
            if (this.selectedPointSegmentIndex == -1) {
                return;
            }
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

            if (this.selectedPointSegmentIndex > 0) {
                this.runRouting(this.selectedPointSegmentIndex - 1, this.selectedPointSegmentIndex);
            }
            if (this.selectedPointSegmentIndex < this.routeSegments.length - 1) {
                this.runRouting(this.selectedPointSegmentIndex, this.selectedPointSegmentIndex + 1);
            }
            this.selectedPointSegmentIndex = -1;
        }

        private removePoint = (point: L.Marker) => {
            var pointSegmentToRemove = _.find(this.routeSegments,(pointSegmentTofind) => pointSegmentTofind.routePoint.getLatLng().equals(point.getLatLng()));
            var pointSegmentIndex = this.routeSegments.indexOf(pointSegmentToRemove);
            this.removeSegment(pointSegmentIndex);

            if (this.routeSegments.length > 0 && pointSegmentIndex == 0) {
                // first point is being removed
                this.routeSegments[0].polyline.setLatLngs([this.routeSegments[0].routePoint.getLatLng()]);
                this.eventHelper.raiseEvent({ applyToScope: true });
            }
            else if (pointSegmentIndex != 0 && pointSegmentIndex < this.routeSegments.length) {
                // middle point is being removed...
                this.runRouting(pointSegmentIndex - 1, pointSegmentIndex).then(() => this.eventHelper.raiseEvent({ applyToScope: true }));
            }
        }

        private runRouting = (startIndex: number, endIndex: number): angular.IPromise<any> => {
            var startSegment = this.routeSegments[startIndex];
            var endSegment = this.routeSegments[endIndex];
            this.removeMiddleMarkerBySegment(endSegment);
            var router = this.routerFactory.create(this.routingType);
            var promise = router.getRoute(startSegment.routePoint.getLatLng(), endSegment.routePoint.getLatLng());

            promise.then((data) => {
                this.routeSegments[endIndex].polyline.setLatLngs(data[data.length - 1].latlngs);
                this.addMiddleMarkersToSegment(this.routeSegments[endIndex]);
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
                if (this.findDistanceToClosestMarker(latlng) <= DrawingRouteService.MINIMAL_DISTANCE_BETWEEN_MARKERS) {
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
            if (this.routeSegments.length > 0 && this.enabled && this.hoverEnabled) {
                var hoverStartPoint = this.routeSegments[this.routeSegments.length - 1].routePoint.getLatLng();
                this.hoverPolyline.setLatLngs([hoverStartPoint, latlng]);
            }
        }

        public getData = (): Common.RouteData => {
            var pointsSegments = <Common.RouteSegmentData[]>[];
            for (var wayPointIndex = 0; wayPointIndex < this.routeSegments.length; wayPointIndex++) {
                var pointSegment = this.routeSegments[wayPointIndex];
                pointsSegments.push(<Common.RouteSegmentData> {
                    routePoint: pointSegment.routePoint.getLatLng(),
                    latlngs: angular.copy(pointSegment.polyline.getLatLngs()),
                });
            }
            return <Common.RouteData>{ routingType: this.routingType, segments: pointsSegments };
        }

        public setData = (data: Common.RouteData) => {
            this.internalclear();
            for (var pointIndex = 0; pointIndex < data.segments.length; pointIndex++) {
                var segment = data.segments[pointIndex];
                var latlngs = segment.latlngs.length > 0 ? segment.latlngs : [segment.routePoint];
                this.routeSegments.push(this.createRouteSegment(latlngs));
            }
            this.routingType = data.routingType;
        }

        public clear = () => {
            this.internalclear();
        }

        private internalclear = () => {
            for (var segmentIndex = this.routeSegments.length - 1; segmentIndex >= 0; segmentIndex--) {
                this.removeSegment(segmentIndex);
            }
        }

        private removeSegment = (segmentIndex: number) => {
            var segment = this.routeSegments[segmentIndex];
            this.destoryMarker(segment.routePoint);
            this.map.removeLayer(segment.polyline);
            this.removeMiddleMarkerBySegment(segment);
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
            marker.off("click");
            marker.off("dragstart");
            marker.off("drag");
            marker.off("dragend");
            marker.off("mouseover");
            marker.off("mouseout");
            this.map.removeLayer(marker);
        }
    }
}