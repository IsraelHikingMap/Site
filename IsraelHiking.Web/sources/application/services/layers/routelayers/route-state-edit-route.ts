import * as L from "leaflet";
import * as _ from "lodash";

import { RouteStateEditBase } from "./route-state-edit-base";
import { IRouteLayer, IRouteSegment } from "./iroute.layer";
import { IconsService } from "../../icons.service";
import { RouteStateHelper } from "./route-state-helper";
import { RouteStatePoiHelper } from "./route-state-poi-helper";
import { LatLngAlt, ILatLngTime, RouteStateName } from "../../../models/models";

export class RouteStateEditRoute extends RouteStateEditBase {
    private selectedRouteSegmentIndex: number;

    constructor(context: IRouteLayer) {
        super(context);
        this.selectedRouteSegmentIndex = -1;
        this.initialize();
    }

    public initialize() {
        for (let routeMarkerWithData of this.context.route.markers) {
            routeMarkerWithData.marker = RouteStatePoiHelper.createPoiMarker(routeMarkerWithData, false, this.context);
        }
        super.initialize();
        for (let segment of this.context.route.segments) {
            segment.routePointMarker = this.createRouteMarker(segment.routePoint);
        }
        this.updateStartAndEndMarkersIcons();
    }
    private updateStartAndEndMarkersIcons = () => {
        if (this.context.route.segments.length <= 0) {
            return;
        }
        this.context.getLastSegment().routePointMarker.setIcon(IconsService.createEndIcon());
        this.context.route.segments[0].routePointMarker.setIcon(IconsService.createStartIcon());
        for (let routeSegmentIndex = 1; routeSegmentIndex < this.context.route.segments.length - 1; routeSegmentIndex++) {
            let routeMarkerIcon = IconsService.createRouteMarkerIcon(this.context.route.properties.pathOptions.color);
            this.context.route.segments[routeSegmentIndex].routePointMarker.setIcon(routeMarkerIcon);
        }
    }

    protected addPoint(e: L.LeafletMouseEvent): void {
        let response = this.context.getSnappingForRoute(e.latlng);
        if (response.isSnapToSelfRoute) {
            return;
        }
        this.addPointToRoute(response.latlng, this.context.route.properties.currentRoutingType).then(() => {
            this.context.raiseDataChanged();
        });
        // this.hoverHandler.setState(HoverHandlerState.NONE);
    }

    private addPointToRoute = async (latlng: LatLngAlt, routingType: string): Promise<{}> => {
        this.context.route.segments.push(this.createRouteSegment(latlng, [latlng, latlng], routingType));
        this.updateStartAndEndMarkersIcons();
        if (this.context.route.segments.length > 1) {
            let endPointSegmentIndex = this.context.route.segments.length - 1;
            return await this.runRouting(endPointSegmentIndex - 1, endPointSegmentIndex);
        } else if (this.context.route.segments.length === 1) {
            return await this.context.elevationProvider.updateHeights(this.context.route.segments[0].latlngs);
        }
    }

    public getStateName(): RouteStateName {
        return "Route";
    }

    private createRouteMarker = (latlng: LatLngAlt): L.Marker => {
        let pathOptions = this.context.route.properties.pathOptions;
        let marker = L.marker(latlng,
            {
                draggable: true,
                clickable: true,
                riseOnHover: true,
                zIndexOffset: 1000,
                icon: IconsService.createRouteMarkerIcon(pathOptions.color),
                opacity: pathOptions.opacity
            } as L.MarkerOptions);
        this.setRouteMarkerEvents(marker);
        // marker.addTo(this.context.mapService.map);
        // let factory = this.context.componentFactoryResolver.resolveComponentFactory(RouteMarkerPopupComponent);
        let containerDiv = L.DomUtil.create("div");
        // let routeMarkerPopupComponentRef = factory.create(this.context.injector, [], containerDiv);
        // routeMarkerPopupComponentRef.instance.setMarker(marker as Common.IMarkerWithTitle);
        // routeMarkerPopupComponentRef.instance.remove = () => {
        //    let segment = _.find(this.context.route.segments, segmentToFind => marker === segmentToFind.routePointMarker);
        //    this.removeRouteSegment(segment);
        // };
        // routeMarkerPopupComponentRef.instance.angularBinding(routeMarkerPopupComponentRef.hostView);
        marker.bindPopup(containerDiv);
        return marker;
    }

    private removeRouteSegment = (segment: IRouteSegment) => {
        let segmentIndex = this.context.route.segments.indexOf(segment);
        this.removeSegmentLayers(segment);
        this.updateStartAndEndMarkersIcons();

        if (this.context.route.segments.length > 0 && segmentIndex === 0) {
            // first point is being removed
            this.context.route.segments[0].latlngs = [_.last(this.context.route.segments[0].latlngs)];
            let routePoint = this.context.route.segments[0].routePoint;
            this.context.route.segments[0].polyline.setLatLngs([routePoint, routePoint]);
            this.context.raiseDataChanged();
        } else if (segmentIndex !== 0 && segmentIndex < this.context.route.segments.length) {
            // middle point is being removed...
            this.runRouting(segmentIndex - 1, segmentIndex).then(() => this.context.raiseDataChanged());
        } else {
            this.context.raiseDataChanged();
        }
    }

    protected createRouteSegment = (latlng: LatLngAlt, latlngs: LatLngAlt[], routingType: string): IRouteSegment => {
        let routeSegment = {
            // routePointMarker: (this.hoverHandler.getState() !== HoverHandlerState.DRAGGING)
            //    ? this.createRouteMarker(latlng)
            //    : null,
            routePoint: latlng,
            polyline: L.polyline(latlngs, this.context.route.properties.pathOptions),
            latlngs: latlngs,
            routingType: routingType
        } as IRouteSegment;
        // routeSegment.polyline.addTo(this.context.mapService.map);
        return routeSegment;
    }

    private setRouteMarkerEvents = (marker: L.Marker) => {
        marker.on("dragstart", () => {
            // this.hoverHandler.setState(HoverHandlerState.ON_MARKER);
            this.dragRouteMarkerStart(marker);
        });
        marker.on("drag", () => {
            this.dragRouteMarker(marker);
        });
        marker.on("dragend", () => {
            this.dragRouteMarkerEnd(marker);
            // this.hoverHandler.setState(HoverHandlerState.NONE);
        });
        marker.on("mouseover", () => {
            // if (this.hoverHandler.getState() !== HoverHandlerState.DRAGGING) {
            //    this.hoverHandler.setState(HoverHandlerState.ON_MARKER);
            // }
        });
        marker.on("mouseout", () => {
            // if (this.hoverHandler.getState() !== HoverHandlerState.DRAGGING) {
            //    this.hoverHandler.setState(HoverHandlerState.NONE);
            // }
        });
    }

    private dragRouteMarkerStart = (point: L.Marker) => {
        let pointSegmentToDrag = _.find(this.context.route.segments,
            (pointSegmentTofind) => pointSegmentTofind.routePointMarker.getLatLng().equals(point.getLatLng()));
        this.selectedRouteSegmentIndex = pointSegmentToDrag == null ? -1 : this.context.route.segments.indexOf(pointSegmentToDrag);
    }

    private dragRouteMarker = (marker: L.Marker) => {
        if (this.selectedRouteSegmentIndex === -1) {
            return;
        }
        let snappingResponse = this.context.getSnappingForRoute(marker.getLatLng(), false);
        marker.setLatLng(snappingResponse.latlng);
        this.context.route.segments[this.selectedRouteSegmentIndex].routePoint = snappingResponse.latlng;
        let segmentStartLatlng = this.selectedRouteSegmentIndex === 0
            ? [snappingResponse.latlng]
            : [this.context.route.segments[this.selectedRouteSegmentIndex - 1].routePointMarker.getLatLng(), snappingResponse.latlng];
        this.context.route.segments[this.selectedRouteSegmentIndex].polyline.setLatLngs(segmentStartLatlng);
        if (this.selectedRouteSegmentIndex < this.context.route.segments.length - 1) {
            this.context.route.segments[this.selectedRouteSegmentIndex + 1].polyline.setLatLngs([
                snappingResponse.latlng,
                this.context.route.segments[this.selectedRouteSegmentIndex + 1].routePointMarker.getLatLng()
            ]);
        }
    }

    private dragRouteMarkerEnd = (marker: L.Marker) => {
        if (this.selectedRouteSegmentIndex === -1) {
            return;
        }
        let snappingResponse = this.context.getSnappingForRoute(marker.getLatLng(), false);
        marker.setLatLng(snappingResponse.latlng);
        this.context.route.segments[this.selectedRouteSegmentIndex].routePoint = snappingResponse.latlng;
        this.context.route.segments[this.selectedRouteSegmentIndex].routingType = this.context.route.properties.currentRoutingType;
        let selectedRouteSegmentLatlngs = this.context.route.segments[this.selectedRouteSegmentIndex].latlngs;
        selectedRouteSegmentLatlngs[selectedRouteSegmentLatlngs.length - 1] = snappingResponse.latlng as ILatLngTime;
        let chain = Promise.resolve({});
        let selectedRouteSegmentIndex = this.selectedRouteSegmentIndex; // closure
        if (this.selectedRouteSegmentIndex === 0) {
            this.context.route.segments[0].latlngs = [snappingResponse.latlng, snappingResponse.latlng] as ILatLngTime[];
            chain = chain.then(() => this.context.elevationProvider.updateHeights(this.context.route.segments[0].latlngs));
        } else if (this.selectedRouteSegmentIndex > 0) {
            chain = chain.then(() => this.runRouting(selectedRouteSegmentIndex - 1, selectedRouteSegmentIndex));
        }
        if (this.selectedRouteSegmentIndex < this.context.route.segments.length - 1) {
            chain = chain.then(() => this.runRouting(selectedRouteSegmentIndex, selectedRouteSegmentIndex + 1));
        }
        this.selectedRouteSegmentIndex = -1;
        chain.then(() => this.context.raiseDataChanged());
    }

    private middleMarkerDragStart = (middleMarker: L.Marker) => {
        // this.hoverHandler.setState(HoverHandlerState.DRAGGING);
        let snappingResponse = this.context.snapToSelf(middleMarker.getLatLng());
        this.selectedRouteSegmentIndex = snappingResponse.lineIndex;
        let latlngs = [
            this.context.route.segments[this.selectedRouteSegmentIndex - 1].routePointMarker.getLatLng(),
            snappingResponse.latlng
        ];
        let newSegment = this.createRouteSegment(snappingResponse.latlng, latlngs, this.context.route.properties.currentRoutingType);
        this.context.route.segments.splice(this.selectedRouteSegmentIndex, 0, newSegment);
    }

    private middleMarkerDrag = (middleMarker: L.Marker) => {
        if (this.selectedRouteSegmentIndex === -1) {
            return;
        }
        let snappingResponse = this.context.getSnappingForRoute(middleMarker.getLatLng(), false);
        middleMarker.setLatLng(snappingResponse.latlng);
        this.context.route.segments[this.selectedRouteSegmentIndex + 1].polyline.setLatLngs(
            [snappingResponse.latlng, this.context.route.segments[this.selectedRouteSegmentIndex + 1].routePointMarker.getLatLng()]
        );
        this.context.route.segments[this.selectedRouteSegmentIndex].polyline.setLatLngs(
            [this.context.route.segments[this.selectedRouteSegmentIndex - 1].routePointMarker.getLatLng(), snappingResponse.latlng]
        );
    }

    private middleMarkerDragEnd = (middleMarker: L.Marker) => {
        let snappingResponse = this.context.getSnappingForRoute(middleMarker.getLatLng(), false);
        this.context.route.segments[this.selectedRouteSegmentIndex].routePointMarker = this.createRouteMarker(snappingResponse.latlng);
        this.context.route.segments[this.selectedRouteSegmentIndex].routePoint = snappingResponse.latlng;
        let selectedSegmentLatlngs = this.context.route.segments[this.selectedRouteSegmentIndex].latlngs;
        selectedSegmentLatlngs[selectedSegmentLatlngs.length - 1] = snappingResponse.latlng as ILatLngTime;
        let selectedRouteSegmentIndex = this.selectedRouteSegmentIndex; // closure;
        this.runRouting(selectedRouteSegmentIndex - 1, selectedRouteSegmentIndex)
            .then(() => this.runRouting(selectedRouteSegmentIndex, selectedRouteSegmentIndex + 1))
            .then(() => this.context.raiseDataChanged());
        this.selectedRouteSegmentIndex = -1;
        // this.hoverHandler.setState(HoverHandlerState.NONE);
    }

    // private createMiddleMarker = (): L.Marker => {
    //    let middleMarker = L.marker(this.context.mapService.map.getCenter(),
    //        {
    //            clickable: true,
    //            draggable: true,
    //            icon: IconsService.createRoundIcon(this.context.route.properties.pathOptions.color),
    //            opacity: 0.0
    //        } as L.MarkerOptions);
    //    middleMarker.on("click", () => {
    //        this.middleMarkerClick(middleMarker);
    //    });
    //
    //    middleMarker.on("dragstart", () => {
    //        this.middleMarkerDragStart(middleMarker);
    //    });
    //
    //    middleMarker.on("drag", () => {
    //        this.middleMarkerDrag(middleMarker);
    //    });
    //
    //    middleMarker.on("dragend", () => {
    //        this.middleMarkerDragEnd(middleMarker);
    //    });
    //
    //    return middleMarker;
    // }

    private middleMarkerClick = (middleMarker: L.Marker) => {
        let snappingResponse = this.context.snapToSelf(middleMarker.getLatLng());
        if (snappingResponse.line == null) {
            return;
        }
        let segment = this.context.route.segments[snappingResponse.lineIndex];
        let segmentlatlngs = segment.latlngs;
        // HM TODO: allow splitting - need to find closest point.
        // let newSegmentLatlngs = segmentlatlngs.splice(0, snappingResponse.beforeIndex + 1);
        // let newRouteSegment = this.createRouteSegment(snappingResponse.latlng, newSegmentLatlngs,
        //    this.context.route.properties.currentRoutingType);
        // segment.polyline.setLatLngs(segmentlatlngs);
        // this.context.route.segments.splice(snappingResponse.lineIndex, 0, newRouteSegment);
    }

    private removeSegmentLayers = (segment: IRouteSegment) => {
        RouteStateHelper.destroyMarker(segment.routePointMarker, this.context);
        // this.context.mapService.map.removeLayer(segment.polyline);
        this.context.route.segments.splice(this.context.route.segments.indexOf(segment), 1);
    }

    public reRoute = (): void => {
        let chain = Promise.resolve({});
        for (let segmentIndex = 1; segmentIndex < this.context.route.segments.length; segmentIndex++) {
            chain = chain.then(() => this.runRouting(segmentIndex - 1, segmentIndex));
        }
        chain.then(() => this.context.raiseDataChanged());
    }

    private runRouting = async (startIndex: number, endIndex: number): Promise<any> => {
        let startSegment = this.context.route.segments[startIndex];
        let endSegment = this.context.route.segments[endIndex];
        let loadingPolyline = this.createLoadingSegmentIndicatorPolyline([startSegment.routePoint, endSegment.routePoint]);
        let startLatLng = startSegment.routePoint;
        let startSegmentEndPoint = startSegment.latlngs[startSegment.latlngs.length - 1];
        if (endSegment.routingType === "None") {
            startLatLng = startSegmentEndPoint;
        }
        endSegment.polyline.setLatLngs([]);
        let routingType = endSegment.routingType || this.context.route.properties.currentRoutingType;
        let data = await this.context.routerService.getRoute(startLatLng, endSegment.routePoint, routingType);

        // this.context.mapService.map.removeLayer(loadingPolyline);
        let latlngs = data[data.length - 1].latlngs;
        if (startSegment.routingType === "None" && (
            startSegmentEndPoint.lat !== latlngs[0].lat ||
            startSegmentEndPoint.lng !== latlngs[0].lng)) {
            // need to connect the non-routed segment in case it isn't
            latlngs = [startSegmentEndPoint].concat(latlngs);
        }
        let endSegmentRoute = this.context.route.segments[endIndex];
        endSegmentRoute.latlngs = latlngs;
        endSegmentRoute.polyline.setLatLngs(this.context.route.segments[endIndex].latlngs);
        this.context.elevationProvider.updateHeights(endSegmentRoute.latlngs);
    }

    private createLoadingSegmentIndicatorPolyline = (latlngs: LatLngAlt[]): L.Polyline => {
        let loadingSegmentPathOptions = { ...this.context.route.properties.pathOptions };
        loadingSegmentPathOptions.dashArray = "10 10";
        loadingSegmentPathOptions.className = "loading-segment-indicator";
        let polyline = L.polyline(latlngs, loadingSegmentPathOptions);
        // this.context.mapService.map.addLayer(polyline);
        return polyline;
    }
}