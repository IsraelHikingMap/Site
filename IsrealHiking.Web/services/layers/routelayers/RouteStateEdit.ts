namespace IsraelHiking.Services.Layers.RouteLayers {
    export abstract class RouteStateEdit extends RouteStateBase {
        protected hoverHandler: HoverHandler;
        private selectedRouteSegmentIndex: number;

        constructor(context: RouteLayer) {
            super(context);
            this.selectedRouteSegmentIndex = -1;
            this.hoverHandler = new HoverHandler(context, this.createMiddleMarker());
            this.initialize();
        }

        protected abstract addPoint(e: L.LeafletMouseEvent): void;

        public initialize() {
            this.context.map.on("click", this.addPoint, this);
            this.context.map.on("mousemove", this.hoverHandler.onMouseMove, this.hoverHandler);
            this.context.snappingService.enable(true);
            for (let segment of this.context.route.segments) {
                segment.polyline = L.polyline(segment.latlngzs, this.context.route.properties.pathOptions);
                segment.routePointMarker = this.createRouteMarker(segment.routePoint);
                this.context.map.addLayer(segment.polyline);
            }
            for (let marker of this.context.route.markers) {
                marker.marker = this.createPoiMarkerWithEvents(marker);
                this.context.map.addLayer(marker.marker);
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
            this.context.map.off("click", this.addPoint, this);
            this.hoverHandler.setState(HoverHandler.NONE);
        }

        private createRouteMarker = (latlng: L.LatLng): L.Marker => {
            let pathOptions = this.context.route.properties.pathOptions;
            let marker = L.marker(latlng, { draggable: true, clickable: true, riseOnHover: true, icon: IconsService.createRouteMarkerIcon(pathOptions.color), opacity: pathOptions.opacity } as L.MarkerOptions);
            this.setRouteMarkerEvents(marker);
            marker.addTo(this.context.map);
            let newScope = this.context.$rootScope.$new() as Controllers.MarkerPopup.IRemovableMarkerScope;
            newScope.marker = marker as IMarkerWithTitle;

            newScope.remove = () => {
                let segment = _.find(this.context.route.segments, segmentToFind => marker === segmentToFind.routePointMarker);
                this.removeRouteSegment(segment); 
            }
            marker.bindPopup(this.context.$compile("<div route-marker-popup></div>")(newScope)[0]);
            return marker;
        }

        protected updateStartAndEndMarkersIcons = () => {
            if (this.context.route.segments.length <= 0) {
                return;
            }
            this.context.route.segments[this.context.route.segments.length - 1].routePointMarker.setIcon(IconsService.createEndIcon());
            this.context.route.segments[0].routePointMarker.setIcon(IconsService.createStartIcon());
            for (let routeSegmentIndex = 1; routeSegmentIndex < this.context.route.segments.length - 1; routeSegmentIndex++) {
                this.context.route.segments[routeSegmentIndex].routePointMarker.setIcon(IconsService.createRouteMarkerIcon(this.context.route.properties.pathOptions.color));
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
            this.context.route.segments[this.selectedRouteSegmentIndex].routePoint = snappingResponse.latlng;
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
            let snapLatLngZ = this.context.getLatLngZFromLatLng(snappingResponse.latlng);
            this.context.route.segments[this.selectedRouteSegmentIndex].routePoint = snappingResponse.latlng;
            this.context.route.segments[this.selectedRouteSegmentIndex].routingType = this.context.route.properties.currentRoutingType;
            this.context.route.segments[this.selectedRouteSegmentIndex].latlngzs[this.context.route.segments[this.selectedRouteSegmentIndex].latlngzs.length - 1] = snapLatLngZ;
            let chain = this.context.$q.when();
            var selectedRouteSegmentIndex = this.selectedRouteSegmentIndex; //closure
            if (this.selectedRouteSegmentIndex === 0) {
                this.context.route.segments[0].latlngzs = [snapLatLngZ, snapLatLngZ];
                chain = chain.then(() => this.context.elevationProvider.updateHeights(this.context.route.segments[0].latlngzs)) as angular.IPromise<any>;
            }
            else if (this.selectedRouteSegmentIndex > 0) {
                chain = chain.then(() => this.runRouting(selectedRouteSegmentIndex - 1, selectedRouteSegmentIndex));
            }
            if (this.selectedRouteSegmentIndex < this.context.route.segments.length - 1) {
                chain = chain.then(() => this.context.$q.resolve(this.runRouting(selectedRouteSegmentIndex, selectedRouteSegmentIndex + 1)));
            }
            this.selectedRouteSegmentIndex = -1;
            chain.then(() => this.context.dataChanged());
        }

        private removeRouteSegment = (segment: IRouteSegment) => {
            var segmentIndex = this.context.route.segments.indexOf(segment);
            this.removeSegmentLayers(segment);
            this.updateStartAndEndMarkersIcons();

            if (this.context.route.segments.length > 0 && segmentIndex === 0) {
                //first point is being removed
                this.context.route.segments[0].latlngzs = [this.context.route.segments[0].latlngzs[this.context.route.segments[0].latlngzs.length - 1]];
                this.context.route.segments[0].polyline.setLatLngs([this.context.route.segments[0].routePoint, this.context.route.segments[0].routePoint]);
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

        private setRouteMarkerEvents = (marker: L.Marker) => {
            marker.on("dragstart", () => {
                this.hoverHandler.setState(HoverHandler.ON_MARKER);
                this.dragPointStart(marker);
            });
            marker.on("drag", () => {
                this.dragPoint(marker);
            });
            marker.on("dragend", () => {
                this.dragPointEnd(marker);
                this.hoverHandler.setState(HoverHandler.NONE);
            });
            marker.on("mouseover", () => {
                if (this.hoverHandler.getState() !== HoverHandler.DRAGGING) {
                    this.hoverHandler.setState(HoverHandler.ON_MARKER);
                }
            });
            marker.on("mouseout", () => {
                if (this.hoverHandler.getState() !== HoverHandler.DRAGGING) {
                    this.hoverHandler.setState(HoverHandler.NONE);
                }
            });
        }

        protected createRouteSegment = (latlng: L.LatLng, latlngzs: Common.LatLngZ[], routingType: string): IRouteSegment => {
            var routeSegment = {
                routePointMarker: (this.hoverHandler.getState() !== HoverHandler.DRAGGING)
                    ? this.createRouteMarker(latlng)
                    : null,
                routePoint: latlng,
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
            var polyline = this.createLoadingSegmentIndicatorPolyline([startSegment.routePoint, endSegment.routePoint]);
            var startLatLng = startSegment.routePoint;
            var startSegmentEndPoint = startSegment.latlngzs[startSegment.latlngzs.length - 1];
            if (endSegment.routingType === "None") {
                startLatLng = startSegmentEndPoint;
            }
            var promise = this.context.routerService.getRoute(startLatLng, endSegment.routePoint, endSegment.routingType);
            var deferred = this.context.$q.defer();
            promise.then((data) => {
                this.context.map.removeLayer(polyline);
                var latlngs = data[data.length - 1].latlngzs;
                if (startSegment.routingType === "None" && !startSegmentEndPoint.equals(latlngs[0])) {
                    // need to connect the non-routed segment in case it isn't
                    latlngs = [startSegmentEndPoint].concat(latlngs);
                }
                this.context.route.segments[endIndex].latlngzs = latlngs;
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
            var newRouteSegment = this.createRouteSegment(snappingResponse.latlng, newSegmentLatlngs, this.context.route.properties.currentRoutingType);
            segment.polyline.setLatLngs(segmentLatlngzs);
            this.context.route.segments.splice(indexOfSegment, 0, newRouteSegment);
        }

        private middleMarkerDragStart = (middleMarker: L.Marker) => {
            this.hoverHandler.setState(HoverHandler.DRAGGING);
            let snappingResponse = this.context.snapToRoute(middleMarker.getLatLng());
            this.selectedRouteSegmentIndex = _.findIndex(this.context.route.segments, (segment) => segment.polyline === snappingResponse.polyline);
            let latlngzs = [this.context.getLatLngZFromLatLng(this.context.route.segments[this.selectedRouteSegmentIndex - 1].routePointMarker.getLatLng()),
                this.context.getLatLngZFromLatLng(snappingResponse.latlng)];
            let newSegment = this.createRouteSegment(snappingResponse.latlng, latlngzs, this.context.route.properties.currentRoutingType);
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
            this.context.route.segments[this.selectedRouteSegmentIndex].routePointMarker = this.createRouteMarker(snappingResponse.latlng);
            this.context.route.segments[this.selectedRouteSegmentIndex].routePoint = snappingResponse.latlng;
            this.context.route.segments[this.selectedRouteSegmentIndex].latlngzs[this.context.route.segments[this.selectedRouteSegmentIndex].latlngzs.length - 1] = this.context.getLatLngZFromLatLng(snappingResponse.latlng);
            var selectedRouteSegmentIndex = this.selectedRouteSegmentIndex; // closure;
            this.runRouting(selectedRouteSegmentIndex - 1, selectedRouteSegmentIndex)
                .then(() => this.runRouting(selectedRouteSegmentIndex, selectedRouteSegmentIndex + 1))
                .then(() => this.context.dataChanged());
            this.selectedRouteSegmentIndex = -1;
            this.hoverHandler.setState(HoverHandler.NONE);
        }

        private createMiddleMarker = (): L.Marker => {
            var middleMarker = L.marker(this.context.map.getCenter(), { clickable: true, draggable: true, icon: IconsService.createRoundIcon(this.context.route.properties.pathOptions.color), opacity: 0.0 } as L.MarkerOptions);
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

        protected destoryMarker = (marker: L.Marker) => {
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
            marker.off("popupopen");
            marker.off("popupclose");
            this.context.map.removeLayer(marker);
            this.hoverHandler.setState(HoverHandler.NONE);
        }

        public reRoute = (): void => {
            var chain = this.context.$q.when();
            for (let segmentIndex = 1; segmentIndex < this.context.route.segments.length; segmentIndex++) {
                chain = chain.then(() => this.runRouting(segmentIndex - 1, segmentIndex));
            }
            chain.then(() => this.context.dataChanged());
        }

        protected createPoiMarkerWithEvents(markerData: Common.MarkerData): IMarkerWithTitle {
            let marker = this.createPoiMarker(markerData, true);
            var newScope = this.context.$rootScope.$new() as Controllers.MarkerPopup.IPoiMarkerPopupScope;
            newScope.marker = marker;
            newScope.routeLayer = this.context;
            this.setPoiMarkerEvents(marker);
            newScope.remove = () => {
                let routeMarker = _.find(this.context.route.markers, markerToFind => markerToFind.marker === marker);
                this.removePoi(routeMarker);
            }
            let popupHtml = this.context.$compile("<div poi-marker-popup></div>")(newScope)[0];
            marker.bindPopup(popupHtml);
            return marker;
        }

        private setPoiMarkerEvents(marker: L.Marker) {
            marker.on("dragstart", () => {
                marker.closePopup();
                this.hoverHandler.setState(RouteLayers.HoverHandler.DRAGGING);
            });
            marker.on("dragend", () => {
                let markerInArray = _.find(this.context.route.markers, markerToFind => markerToFind.marker === marker);
                markerInArray.latlng = marker.getLatLng();
                this.context.dataChanged();
                this.hoverHandler.setState(HoverHandler.NONE);
            });
            marker.on("mouseover", () => {
                if (this.hoverHandler.getState() !== RouteLayers.HoverHandler.DRAGGING) {
                    this.hoverHandler.setState(RouteLayers.HoverHandler.ON_MARKER);
                }
            });
            marker.on("mouseout", () => {
                if (this.hoverHandler.getState() !== RouteLayers.HoverHandler.DRAGGING) {
                    this.hoverHandler.setState(RouteLayers.HoverHandler.NONE);
                }
            });
        }

        private removePoi = (poi: IMarkerWithData) => {
            let poiToRemove = _.find(this.context.route.markers, markerToFind => markerToFind === poi);
            this.context.route.markers.splice(this.context.route.markers.indexOf(poiToRemove), 1);
            this.destoryMarker(poiToRemove.marker);
            this.context.dataChanged();
        }
    }
}