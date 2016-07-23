namespace IsraelHiking.Services.Layers.RouteLayers {
    export abstract class RouteStateEditBase extends RouteStateBase {
        protected hoverHandler: IHoverHandler;
        private selectedRouteSegmentIndex: number;

        constructor(context: RouteLayer) {
            super(context);
            this.selectedRouteSegmentIndex = -1;
        }

        protected abstract addPoint(e: L.LeafletMouseEvent): void;

        public initialize() {
            this.context.map.on("click", this.addPoint, this);
            this.context.map.on("mousemove", this.hoverHandler.onMouseMove, this.hoverHandler);
            this.context.snappingService.enable(true);
            for (let segment of this.context.route.segments) {
                segment.polyline = L.polyline(segment.latlngzs, this.context.route.properties.pathOptions);
                segment.routePointMarker = this.createMarker(segment.routePoint, true);
                this.context.map.addLayer(segment.polyline);
            }
            for (let marker of this.context.route.markers) {
                marker.marker = this.createMarker(marker, false);
            }
            this.updateStartAndEndMarkersIcons();
        }

        public clear() {
            for (let segment of this.context.route.segments) {
                this.context.map.removeLayer(segment.polyline);
                this.destoryMarker(segment.routePointMarker);
            }
            for (let marker of this.context.route.markers) {
                this.destoryMarker(marker.marker);
            }
            this.context.snappingService.enable(false);
            this.context.map.off("mousemove", this.hoverHandler.onMouseMove, this.hoverHandler);
            this.hoverHandler.setState(HoverHandlerBase.NONE);
            this.context.map.off("click", this.addPoint, this);
        }


        protected createMarker = (markerData: Common.MarkerData, inRoute: boolean): IMarkerWithTitle => {
            let pathOptions = this.context.route.properties.pathOptions;
            let marker = L.marker(markerData.latlng, { draggable: true, clickable: true, riseOnHover: true, icon: IconsService.createMarkerIconWithColor(pathOptions.color), opacity: pathOptions.opacity } as L.MarkerOptions) as IMarkerWithTitle;
            marker.title = markerData.title;
            this.addLabelAndEvents(marker, inRoute);
            marker.addTo(this.context.map);
            if (!markerData.title) { // must be after adding to map...
                marker.hideLabel();
            }
            return marker;
        }

        private addLabelAndEvents(marker: IMarkerWithTitle, inRoute: boolean): void {
            marker.bindLabel(marker.title, this.context.getBindLabelOptions());
            var newScope = this.context.$rootScope.$new() as Controllers.IMarkerPopupScope;
            newScope.marker = marker;
            newScope.routeLayer = this.context;
            newScope.inRoute = inRoute;
            if (inRoute) {
                this.setRouteMarkerEvents(marker);
                newScope.remove = () => {
                    let segment = _.find(this.context.route.segments, segmentToFind => segmentToFind.routePointMarker === marker);
                    this.removeRouteSegment(segment);
                }
            } else {
                this.setPoiMarkerEvents(marker);
                newScope.remove = () => {
                    let routeMarker = _.find(this.context.route.markers, markerToFind => markerToFind.marker === marker);
                    this.removePoi(routeMarker);
                }
            }
            let popupHtml = this.context.$compile("<marker-popup ng-title='title'></marker-popup>")(newScope)[0];
            marker.bindPopup(popupHtml);
        }

        protected updateStartAndEndMarkersIcons = () => {
            if (this.context.route.segments.length <= 0) {
                return;
            }
            this.context.route.segments[this.context.route.segments.length - 1].routePointMarker.setIcon(IconsService.createEndIcon());
            this.context.route.segments[0].routePointMarker.setIcon(IconsService.createStartIcon());
            for (let routeSegmentIndex = 1; routeSegmentIndex < this.context.route.segments.length - 1; routeSegmentIndex++) {
                this.context.route.segments[routeSegmentIndex].routePointMarker.setIcon(IconsService.createMarkerIconWithColor(this.context.route.properties.pathOptions.color));
            }
        }

        private dragPointStart = (point: L.Marker) => {
            let pointSegmentToDrag = _.find(this.context.route.segments, (pointSegmentTofind) => pointSegmentTofind.routePointMarker.getLatLng().equals(point.getLatLng()));
            this.selectedRouteSegmentIndex = pointSegmentToDrag == null ? -1 : this.context.route.segments.indexOf(pointSegmentToDrag);
        }

        private dragPoint = (marker: L.Marker) => {
            if (this.selectedRouteSegmentIndex === -1) {
                return;
            }
            let snappingResponse = this.context.snappingService.snapTo(marker.getLatLng());
            marker.setLatLng(snappingResponse.latlng);
            this.context.route.segments[this.selectedRouteSegmentIndex].routePoint.latlng = snappingResponse.latlng;
            let segmentStartLatlng = this.selectedRouteSegmentIndex === 0 ? [snappingResponse.latlng] : [this.context.route.segments[this.selectedRouteSegmentIndex - 1].routePointMarker.getLatLng(), snappingResponse.latlng];
            this.context.route.segments[this.selectedRouteSegmentIndex].polyline.setLatLngs(segmentStartLatlng);
            if (this.selectedRouteSegmentIndex < this.context.route.segments.length - 1) {
                this.context.route.segments[this.selectedRouteSegmentIndex + 1].polyline.setLatLngs([snappingResponse.latlng, this.context.route.segments[this.selectedRouteSegmentIndex + 1].routePointMarker.getLatLng()]);
            }
        }

        private dragPointEnd = (marker: L.Marker) => {
            if (this.selectedRouteSegmentIndex === -1) {
                return;
            }
            let snappingResponse = this.context.snappingService.snapTo(marker.getLatLng());
            marker.setLatLng(snappingResponse.latlng);
            this.context.route.segments[this.selectedRouteSegmentIndex].routePoint.latlng = snappingResponse.latlng;
            this.context.route.segments[this.selectedRouteSegmentIndex].routingType = this.context.route.properties.currentRoutingType;
            let tasks = [];
            if (this.selectedRouteSegmentIndex === 0) {
                this.context.route.segments[0].latlngzs = [this.context.getLatLngZFromLatLng(snappingResponse.latlng), this.context.getLatLngZFromLatLng(snappingResponse.latlng)];
                tasks.push(this.context.elevationProvider.updateHeights(this.context.route.segments[0].latlngzs));
            }
            else if (this.selectedRouteSegmentIndex > 0) {
                tasks.push(this.runRouting(this.selectedRouteSegmentIndex - 1, this.selectedRouteSegmentIndex));
            }
            if (this.selectedRouteSegmentIndex < this.context.route.segments.length - 1) {
                tasks.push(this.runRouting(this.selectedRouteSegmentIndex, this.selectedRouteSegmentIndex + 1));
            }
            this.selectedRouteSegmentIndex = -1;
            this.context.$q.all(tasks).then(() => this.context.dataChanged());
        }

        private removeRouteSegment = (segment: IRouteSegment) => {
            var segmentIndex = this.context.route.segments.indexOf(segment);
            this.removeSegmentLayers(segment);
            this.updateStartAndEndMarkersIcons();

            if (this.context.route.segments.length > 0 && segmentIndex === 0) {
                //first point is being removed
                this.context.route.segments[0].latlngzs = [this.context.route.segments[0].latlngzs[this.context.route.segments[0].latlngzs.length - 1]];
                this.context.route.segments[0].polyline.setLatLngs([this.context.route.segments[0].routePoint.latlng, this.context.route.segments[0].routePoint.latlng]);
                this.context.dataChanged();
            }
            else if (segmentIndex !== 0 && segmentIndex < this.context.route.segments.length) {
                //middle point is being removed...
                this.runRouting(segmentIndex - 1, segmentIndex).then(() => this.context.dataChanged());
            }
            else {
                this.context.dataChanged();
            }
        }

        private removePoi = (poi: IRouteMarker) => {
            let poiToRemove = _.find(this.context.route.markers, markerToFind => markerToFind === poi);
            this.context.route.markers.splice(this.context.route.markers.indexOf(poiToRemove), 1);
            this.destoryMarker(poiToRemove.marker);
        }

        private setPoiMarkerEvents(marker: L.Marker) {
            marker.on("dragStart", () => {
                marker.closePopup();
            });
            marker.on("dragend", () => {
                let markerInArray = _.find(this.context.route.markers, markerToFind => markerToFind.marker === marker);
                markerInArray.latlng = marker.getLatLng();
                this.context.dataChanged();
            });
            marker.on("mouseover", () => {
                if (this.hoverHandler.getState() !== HoverHandlerBase.DRAGGING) {
                    this.hoverHandler.setState(HoverHandlerBase.ON_MARKER);
                }
            });
            marker.on("mouseout", () => {
                if (this.hoverHandler.getState() !== HoverHandlerBase.DRAGGING) {
                    this.hoverHandler.setState(HoverHandlerBase.NONE);
                }
            });
        }

        private setRouteMarkerEvents = (marker: L.Marker) => {
            marker.on("dragstart", () => {
                this.hoverHandler.setState(HoverHandlerBase.ON_MARKER);
                this.dragPointStart(marker);
            });
            marker.on("drag", () => {
                this.dragPoint(marker);
            });
            marker.on("dragend", () => {
                this.dragPointEnd(marker);
                this.hoverHandler.setState(HoverHandlerBase.NONE);
            });
            marker.on("mouseover", () => {
                if (this.hoverHandler.getState() !== HoverHandlerBase.DRAGGING) {
                    this.hoverHandler.setState(HoverHandlerBase.ON_MARKER);
                }
            });
            marker.on("mouseout", () => {
                if (this.hoverHandler.getState() !== HoverHandlerBase.DRAGGING) {
                    this.hoverHandler.setState(HoverHandlerBase.NONE);
                }
            });
        }

        protected createRouteSegment = (routePoint: Common.MarkerData, latlngzs: Common.LatLngZ[], routingType: string): IRouteSegment => {
            var routeSegment = {
                routePointMarker: (this.hoverHandler.getState() !== HoverHandlerBase.DRAGGING)
                    ? this.createMarker(routePoint, true)
                    : null,
                routePoint: routePoint,
                polyline: L.polyline(latlngzs, this.context.route.properties.pathOptions),
                latlngzs: latlngzs,
                routingType: routingType
            } as IRouteSegment;
            routeSegment.polyline.addTo(this.context.map);
            return routeSegment;
        }

        private createLoadingSegmentIndicatorPolyline = (latlngs: L.LatLng[]): L.Polyline => {
            let loadingSegmentPathOptions = angular.copy(this.context.route.properties.pathOptions);
            loadingSegmentPathOptions.dashArray = "10 10";
            loadingSegmentPathOptions.className = "loading-segment-indicator";
            var polyline = L.polyline(latlngs, loadingSegmentPathOptions);
            this.context.map.addLayer(polyline);
            return polyline;
        }

        protected runRouting = (startIndex: number, endIndex: number): angular.IPromise<any> => {
            var startSegment = this.context.route.segments[startIndex];
            var endSegment = this.context.route.segments[endIndex];
            var polyline = this.createLoadingSegmentIndicatorPolyline([startSegment.routePoint.latlng, endSegment.routePoint.latlng]);
            var promise = this.context.routerService.getRoute(startSegment.routePoint.latlng, endSegment.routePoint.latlng, endSegment.routingType);
            var deferred = this.context.$q.defer();
            promise.then((data) => {
                this.context.map.removeLayer(polyline);
                this.context.route.segments[endIndex].latlngzs = data[data.length - 1].latlngzs;
                this.context.route.segments[endIndex].polyline.setLatLngs(this.context.route.segments[endIndex].latlngzs);
                deferred.resolve(this.context.elevationProvider.updateHeights(this.context.route.segments[endIndex].latlngzs));
            });

            return deferred.promise;
        }

        private middleMarkerClick = (middleMarker: L.Marker) => {
            var snappingResponse = this.context.snapToRoute(middleMarker.getLatLng());
            if (snappingResponse.polyline == null) {
                return;
            }
            var segment = _.find(this.context.route.segments, (segmentToFind) => segmentToFind.polyline === snappingResponse.polyline);
            if (segment == null) {
                return;
            }
            var segmentLatlngzs = segment.latlngzs;
            var indexOfSegment = this.context.route.segments.indexOf(segment);
            var newSegmentLatlngs = segmentLatlngzs.splice(0, snappingResponse.beforeIndex + 1);
            var newRouteSegment = this.createRouteSegment({ latlng: snappingResponse.latlng } as Common.MarkerData, newSegmentLatlngs, this.context.route.properties.currentRoutingType);
            segment.polyline.setLatLngs(segmentLatlngzs);
            this.context.route.segments.splice(indexOfSegment, 0, newRouteSegment);
        }

        private middleMarkerDragStart = (middleMarker: L.Marker) => {
            this.hoverHandler.setState(HoverHandlerBase.DRAGGING);
            let snappingResponse = this.context.snapToRoute(middleMarker.getLatLng());
            this.selectedRouteSegmentIndex = _.findIndex(this.context.route.segments, (segment) => segment.polyline === snappingResponse.polyline);
            let latlngzs = [this.context.getLatLngZFromLatLng(this.context.route.segments[this.selectedRouteSegmentIndex - 1].routePointMarker.getLatLng()),
                this.context.getLatLngZFromLatLng(snappingResponse.latlng)];
            let newSegment = this.createRouteSegment({ latlng: snappingResponse.latlng } as Common.MarkerData, latlngzs, this.context.route.properties.currentRoutingType);
            this.context.route.segments.splice(this.selectedRouteSegmentIndex, 0, newSegment);
        }

        private middleMarkerDrag = (middleMarker: L.Marker) => {
            if (this.selectedRouteSegmentIndex === -1) {
                return;
            }
            let snappingResponse = this.context.snappingService.snapTo(middleMarker.getLatLng());
            middleMarker.setLatLng(snappingResponse.latlng);
            this.context.route.segments[this.selectedRouteSegmentIndex + 1].polyline.setLatLngs([snappingResponse.latlng, this.context.route.segments[this.selectedRouteSegmentIndex + 1].routePointMarker.getLatLng()]);
            this.context.route.segments[this.selectedRouteSegmentIndex].polyline.setLatLngs([this.context.route.segments[this.selectedRouteSegmentIndex - 1].routePointMarker.getLatLng(), snappingResponse.latlng]);
        }

        private middleMarkerDragEnd = (middleMarker: L.Marker) => {
            let snappingResponse = this.context.snappingService.snapTo(middleMarker.getLatLng());
            this.context.route.segments[this.selectedRouteSegmentIndex].routePointMarker = this.createMarker({ latlng: snappingResponse.latlng } as Common.MarkerData, true);
            this.context.route.segments[this.selectedRouteSegmentIndex].routePoint.latlng = snappingResponse.latlng;
            let tasks = [];
            tasks.push(this.runRouting(this.selectedRouteSegmentIndex - 1, this.selectedRouteSegmentIndex));
            tasks.push(this.runRouting(this.selectedRouteSegmentIndex, this.selectedRouteSegmentIndex + 1));
            this.selectedRouteSegmentIndex = -1;
            this.hoverHandler.setState(HoverHandlerBase.NONE);
            this.context.$q.all(tasks).then(() => this.context.dataChanged());
        }

        protected createMiddleMarker = (): L.Marker => {
            var middleMarker = L.marker(this.context.map.getCenter(), { clickable: true, draggable: true, icon: IconsService.createHoverIcon(this.context.route.properties.pathOptions.color), opacity: 0.0 } as L.MarkerOptions);
            middleMarker.on("click", () => {
                this.middleMarkerClick(middleMarker);
            });

            middleMarker.on("dragstart", () => {
                this.middleMarkerDragStart(middleMarker);
            });

            middleMarker.on("drag", () => {
                this.middleMarkerDrag(middleMarker);
            });

            middleMarker.on("dragend", () => {
                this.middleMarkerDragEnd(middleMarker);
            });

            return middleMarker;
        }

        private removeSegmentLayers = (segment: IRouteSegment) => {
            this.destoryMarker(segment.routePointMarker);
            this.context.map.removeLayer(segment.polyline);
            this.context.route.segments.splice(this.context.route.segments.indexOf(segment), 1);
        }

        private destoryMarker = (marker: L.Marker) => {
            if (marker == null) {
                return;
            }
            marker.closePopup();
            marker.off("click");
            marker.off("dragstart");
            marker.off("drag");
            marker.off("dragend");
            marker.off("mouseover");
            marker.off("mouseout");
            marker.off("dblclick");
            this.context.map.removeLayer(marker);
            this.hoverHandler.setState(HoverHandlerBase.NONE);
        }

        public reRoute = (): void => {
            let promises = [];
            for (let segmentIndex = 1; segmentIndex < this.context.route.segments.length; segmentIndex++) {
                promises.push(this.runRouting(segmentIndex - 1, segmentIndex));
            }
            this.context.$q.all(promises).then(() => this.context.dataChanged());
        }
    }
}