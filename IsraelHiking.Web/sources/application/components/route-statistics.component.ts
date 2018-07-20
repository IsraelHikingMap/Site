import { Component, ViewEncapsulation, OnInit, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef, AfterViewChecked } from "@angular/core";
import { trigger, style, transition, animate } from "@angular/animations";
import { Subscription } from "rxjs";
import { D3Service, Selection, BaseType, ScaleContinuousNumeric } from "d3-ng2-service";
import * as L from "leaflet";

import { RoutesService } from "../services/layers/routelayers/routes.service";
import { ResourcesService } from "../services/resources.service";
import { RouteStatisticsService, IRouteStatistics, IRouteStatisticsPoint } from "../services/route-statistics.service";
import { BaseMapComponent } from "./base-map.component";
import { IRouteLayer } from "../services/layers/routelayers/iroute.layer";
import { MapService } from "../services/map.service";
import { IconsService } from "../services/icons.service";
import { CancelableTimeoutService } from "../services/cancelable-timeout.service";
import { SidebarService } from "../services/sidebar.service";
import * as Common from "../common/IsraelHiking";

interface IMargin {
    top: number;
    bottom: number;
    left: number;
    right: number;
}

interface IChartElements {
    svg: Selection<any, {}, null, undefined>;
    chartArea: Selection<SVGGElement, {}, null, undefined>;
    path: Selection<SVGPathElement, {}, null, undefined>;
    hoverGroup: Selection<BaseType, {}, null, undefined>;
    dragRect: Selection<BaseType, {}, null, undefined>;
    xScale: ScaleContinuousNumeric<number, number>;
    yScale: ScaleContinuousNumeric<number, number>;
    hoverChartMarker: L.Marker;
    margin: IMargin;
    width: number;
    height: number;
    dragStartXCoordinate: number;
    isDragging: boolean;
}

@Component({
    selector: "route-statistics",
    templateUrl: "./route-statistics.component.html",
    styleUrls: ["./route-statistics.component.scss"],
    encapsulation: ViewEncapsulation.None,
    animations: [
        trigger("animateChart", [
            transition(
                ":enter", [
                    style({ transform: "scale(0.2)", "transform-origin": "bottom right" }),
                    animate("200ms", style({ transform: "scale(1)", "transform-origin": "bottom right" }))
                ]
            ),
            transition(
                ":leave", [
                    style({ transform: "scale(1)", "transform-origin": "bottom right" }),
                    animate("200ms", style({ transform: "scale(0.2)", "transform-origin": "bottom right" }))
                ]
            )]
        )
    ],

})
export class RouteStatisticsComponent extends BaseMapComponent implements OnInit, OnDestroy, AfterViewChecked {
    private static readonly HOVER_BOX_WIDTH = 140;

    public length: number;
    public gain: number;
    public loss: number;
    public isKmMarkersOn: boolean;
    public isExpanded: boolean;

    @ViewChild("lineChartContainer")
    public lineChartContainer: ElementRef;

    private routeLayer: IRouteLayer;
    private statistics: IRouteStatistics;
    private chartElements: IChartElements;
    private kmMarkersGroup: L.LayerGroup;
    private routeLayerSubscriptions: Subscription[];
    private componentSubscriptions: Subscription[];

    constructor(resources: ResourcesService,
        private readonly changeDetectorRef: ChangeDetectorRef,
        private readonly d3Service: D3Service,
        private readonly mapService: MapService,
        private readonly routesService: RoutesService,
        private readonly routeStatisticsService: RouteStatisticsService,
        private readonly cancelableTimeoutService: CancelableTimeoutService,
        private readonly sidebarService: SidebarService,
    ) {
        super(resources);

        this.isKmMarkersOn = false;
        this.isExpanded = false;
        this.routeLayer = null;
        this.statistics = null;
        this.initalizeStatistics(null);
        this.routeLayerSubscriptions = [];
        this.componentSubscriptions = [];
        this.kmMarkersGroup = L.layerGroup([] as L.Marker[]);
        this.chartElements = {
            margin: { top: 20, right: 50, bottom: 40, left: 70 },
            hoverChartMarker: L.marker(mapService.map.getCenter(), { opacity: 0.0, draggable: false, clickable: false } as L.MarkerOptions)
        } as IChartElements;
        this.mapService.map.addLayer(this.chartElements.hoverChartMarker);
        this.mapService.map.addLayer(this.kmMarkersGroup);
    }

    private initalizeStatistics(statistics: IRouteStatistics): void {
        if (statistics == null) {
            this.length = 0;
            this.gain = 0;
            this.loss = 0;
        } else {
            this.length = statistics.length;
            this.gain = statistics.gain;
            this.loss = statistics.loss;
        }
    }

    public ngOnInit() {
        this.componentSubscriptions.push(this.routesService.routeChanged.subscribe(() => {
            this.routeChanged();
        }));
        this.componentSubscriptions.push(this.resources.languageChanged.subscribe(() => {
            this.redrawChart();
        }));
        this.routeChanged();
    }

    public ngAfterViewChecked(): void {
        if (!this.isVisible()) {
            return;
        }
        if (!this.isExpanded) {
            return;
        }
        if (!this.lineChartContainer.nativeElement) {
            return;
        }
        let chartContainerStyle = window.getComputedStyle(this.lineChartContainer.nativeElement.parentElement);
        if (+this.chartElements.svg.attr("width") !== parseFloat(chartContainerStyle.width)) {
            // Redraw when width changes due to class style changes (sidebar open)
            this.redrawChart();
        }
    }

    public ngOnDestroy() {
        for (let subscription of this.componentSubscriptions) {
            subscription.unsubscribe();
        }
        for (let subscription of this.routeLayerSubscriptions) {
            subscription.unsubscribe();
        }
    }

    public isSidebarVisible() {
        return this.sidebarService.isVisible;
    }

    public getUnits = (number: number): string => {
        return Math.abs(number) > 1000 ? this.resources.kmUnit : this.resources.meterUnit;
    }

    public toShortNumber = (number: number): string => {
        if (number == null) {
            return "0";
        }
        return Math.abs(number) > 1000 ? (number / 1000.0).toFixed(2) : number.toFixed(0);
    }

    public toggle(e: Event): void {
        this.suppressEvents(e);
        this.routeStatisticsService.toggle();
        if (this.routeStatisticsService.isVisible()) {
            this.changeDetectorRef.detectChanges();
            this.redrawChart();
        }
    }

    public isVisible(): boolean {
        return this.routeStatisticsService.isVisible();
    }

    private routeChanged() {
        for (let subscription of this.routeLayerSubscriptions) {
            subscription.unsubscribe();
        }
        this.routeLayer = this.routesService.selectedRoute;
        this.initalizeStatistics(null);
        if (this.routeLayer) {
            this.onRouteDataChanged();
            this.routeLayerSubscriptions.push(this.routeLayer.dataChanged.subscribe(this.onRouteDataChanged));
            this.routeLayerSubscriptions.push(this.routeLayer.polylineHovered.subscribe(
                (latlng: L.LatLng) => this.onPolylineHover(latlng))
            );
        }
    }

    private onRouteDataChanged = () => {
        this.statistics = this.routeStatisticsService.getStatistics(this.routesService.selectedRoute.getData());
        this.initalizeStatistics(this.statistics);
        if (this.isVisible()) {
            this.hideSubRouteSelection();
            this.setRouteColorToChart(this.routeLayer.route.properties.pathOptions.color);
            this.setDataToChart(this.statistics.points.map(p => [p.x, p.y] as [number, number]));
        }
        this.updateKmMarkers();
    }

    private onPolylineHover(latlng: L.LatLng) {
        if (!this.statistics || !this.isVisible()) {
            return;
        }
        if (latlng == null) {
            this.hideChartHover();
            return;
        }
        let x = this.routeStatisticsService.findDistanceForLatLng(this.statistics, latlng);
        if (x <= 0) {
            this.hideChartHover();
            return;
        }
        let point = this.routeStatisticsService.interpolateStatistics(this.statistics, x);
        this.showChartHover(point);
    }

    public redrawChart = () => {
        if (!this.isVisible()) {
            return;
        }
        if (!this.lineChartContainer.nativeElement) {
            return;
        }
        let data = [];
        let routeColor = "black";
        if (this.statistics != null) {
            data = this.statistics.points.map(p => [p.x, p.y]);
            routeColor = this.routeLayer.route.properties.pathOptions.color;
        }

        this.initChart();
        this.createChartAxis();
        this.addChartPath();
        this.addChartDragGroup();
        this.addChartHoverGroup();
        this.addEventsSupport();
        // must be last
        this.setRouteColorToChart(routeColor);
        this.setDataToChart(data);
    }

    private hideChartHover() {
        this.chartElements.hoverGroup.style("display", "none");
        this.chartElements.hoverChartMarker.setOpacity(0.0);
    }

    private showChartHover(point: IRouteStatisticsPoint) {
        if (!point) {
            this.hideChartHover();
            return;
        }
        let chartXCoordinate = this.chartElements.xScale(point.x);
        let chartYCoordinate = this.chartElements.yScale(point.y);
        this.chartElements.hoverGroup.style("display", null);
        this.chartElements.hoverGroup.attr("transform", `translate(${chartXCoordinate}, 0)`);
        this.chartElements.hoverGroup.selectAll("circle").attr("cy", chartYCoordinate);
        let safeDistance = 20;
        let boxPosition = safeDistance;
        if (chartXCoordinate > +this.chartElements.svg.attr("width") / 2) {
            boxPosition = -RouteStatisticsComponent.HOVER_BOX_WIDTH - safeDistance;
        }
        this.chartElements.hoverGroup.select("g").attr("transform", `translate(${boxPosition}, 0)`);
        this.buildAllTextInHoverBox(point);
        this.chartElements.hoverChartMarker.setLatLng(point.latlng);
        this.chartElements.hoverChartMarker.setOpacity(1.0);
    }

    private dragStart = () => {
        let d3 = this.d3Service.getD3();
        this.chartElements.dragStartXCoordinate = d3.mouse(this.chartElements.chartArea.node())[0];
    }

    private onMouseMove = () => {
        let d3 = this.d3Service.getD3();
        d3.event.stopPropagation();
        let chartXCoordinate = d3.mouse(this.chartElements.chartArea.node())[0];
        let xPosition = this.chartElements.xScale.invert(chartXCoordinate);
        let point = this.routeStatisticsService.interpolateStatistics(this.statistics, xPosition);
        this.showChartHover(point);
        if (this.chartElements.dragStartXCoordinate != null) {
            // selecting subroute state
            this.chartElements.isDragging = true;
            this.showSubRouteSelection(point);
        }
    }

    private dragEnd() {
        if (this.chartElements.isDragging) {
            this.chartElements.isDragging = false;
            this.chartElements.dragStartXCoordinate = null;
            return;
        }
        // no draggging - as in click
        this.hideSubRouteSelection();
        this.onMouseMove();
        const timeoutGroupName = "clickOnChart";
        this.cancelableTimeoutService.clearTimeoutByGroup(timeoutGroupName);
        this.cancelableTimeoutService.setTimeoutByGroup(() => {
            this.hideChartHover();
        },
            5000,
            timeoutGroupName);
    }

    private initChart() {
        let d3 = this.d3Service.getD3();
        this.chartElements.svg = d3.select(this.lineChartContainer.nativeElement).select("svg");
        this.chartElements.svg.html("");
        let windowStyle = window.getComputedStyle(this.lineChartContainer.nativeElement);
        let width = +windowStyle.width.replace("px", "");
        let height = +windowStyle.height.replace("px", "");
        this.chartElements.svg.attr("height", height);
        this.chartElements.svg.attr("width", width);
        this.chartElements.width = width - this.chartElements.margin.left - this.chartElements.margin.right;
        this.chartElements.height = height - this.chartElements.margin.top - this.chartElements.margin.bottom;
        this.chartElements.chartArea = this.chartElements.svg.append<SVGGElement>("g")
            .attr("class", "chart-area")
            .attr("transform", `translate(${this.chartElements.margin.left},${this.chartElements.margin.top})`);
        this.chartElements.xScale = d3.scaleLinear().range([0, this.chartElements.width]);
        this.chartElements.yScale = d3.scaleLinear().range([this.chartElements.height, 0]);
        this.chartElements.dragStartXCoordinate = null;
        this.chartElements.isDragging = false;
    }

    private createChartAxis() {
        let d3 = this.d3Service.getD3();
        this.chartElements.chartArea.append("g")
            .attr("class", "x axis")
            .attr("transform", `translate(0,${this.chartElements.height})`)
            .call(d3.axisBottom(this.chartElements.xScale).ticks(5))
            .append("text")
            .attr("fill", "#000")
            .attr("text-anchor", "middle")
            .attr("transform", `translate(${this.chartElements.width / 2},30)`)
            .attr("dir", this.resources.direction)
            .text(this.resources.distanceInKm)
            .select(".domain")
            .remove();

        this.chartElements.chartArea.append("g")
            .attr("class", "y axis")
            .call(d3.axisLeft(this.chartElements.yScale).ticks(5))
            .append("text")
            .attr("fill", "#000")
            .attr("transform", `translate(-30, ${this.chartElements.height / 2}) rotate(-90)`)
            .attr("text-anchor", "middle")
            .attr("dir", this.resources.direction)
            .text(this.resources.heightInMeters);
    }

    private addChartPath() {
        this.chartElements.path = this.chartElements.chartArea.append<SVGPathElement>("path")
            .attr("class", "line")
            .attr("fill", "none")
            .attr("stroke-linejoin", "round")
            .attr("stroke-linecap", "round")
            .attr("stroke-width", 2);
    }

    private addChartDragGroup() {
        let dragGroup = this.chartElements.chartArea.append("g")
            .attr("class", "drag-group");

        this.chartElements.dragRect = dragGroup.append("rect")
            .attr("height", this.chartElements.height)
            .attr("width", 0)
            .attr("x", 0)
            .attr("fill", "gray")
            .attr("opacity", 0.4)
            .style("pointer-events", "none")
            .style("display", "none");
    }

    private addChartHoverGroup() {
        this.chartElements.hoverGroup = this.chartElements.chartArea.append("g")
            .attr("class", "hover-group")
            .style("display", "none");
        this.chartElements.hoverGroup.append("line")
            .attr("y1", 0)
            .attr("x1", 0)
            .attr("x2", 0)
            .attr("y2", this.chartElements.height)
            .attr("stroke", "black")
            .attr("stroke-width", 1);

        this.chartElements.hoverGroup.append("circle")
            .attr("class", "circle-point")
            .attr("cx", 0)
            .attr("cy", 0)
            .attr("r", 3)
            .attr("fill", "black");

        this.chartElements.hoverGroup.append("circle")
            .attr("class", "circle-point-aura")
            .attr("cx", 0)
            .attr("cy", 0)
            .attr("r", 5)
            .attr("fill", "none")
            .attr("stroke-width", 1);

        this.chartElements.hoverGroup.append("g")
            .append("rect")
            .attr("x", 0)
            .attr("y", 0)
            .attr("height", 70)
            .attr("width", RouteStatisticsComponent.HOVER_BOX_WIDTH)
            .attr("stroke", "black")
            .attr("fill", "white")
            .attr("fill-opacity", "0.9");
    }

    private addEventsSupport() {
        // responsive background
        this.chartElements.chartArea.append("rect")
            .attr("width", this.chartElements.width)
            .attr("height", this.chartElements.height)
            .style("fill", "none")
            .style("stroke", "none")
            .style("-moz-user-select", "none")
            .style("pointer-events", "all")
            .on("touchstart mousedown", () => {
                this.dragStart();
            })
            .on("mousemove touchmove", () => {
                this.onMouseMove();
            })
            .on("mouseup touchend", () => {
                this.dragEnd();
            })
            .on("mouseout", () => {
                this.hideChartHover();
            });
    }

    private buildAllTextInHoverBox(point: IRouteStatisticsPoint) {
        this.chartElements.hoverGroup.selectAll("text").remove();
        this.createHoverBoxText(this.resources.distance, point.x.toFixed(2), " " + this.resources.kmUnit, 20);
        this.createHoverBoxText(this.resources.height, point.y.toFixed(0), " " + this.resources.meterUnit, 40);
        // the following is a hack due to cross browser issues...
        this.createHoverBoxText(this.resources.slope, Math.abs(point.slope).toFixed(0) + "%", point.slope < 0 ? "-" : "", 60);
    }

    private createHoverBoxText(title: string, value: string, units: string, y: number) {
        let x = 10;
        if (this.resources.direction === "rtl") {
            x = RouteStatisticsComponent.HOVER_BOX_WIDTH - x;
        }
        let text = this.chartElements.hoverGroup.select("g")
            .append("text")
            .attr("fill", "black")
            .attr("transform", `translate(${x}, ${y})`)
            .attr("text-anchor", "start")
            .attr("direction", this.resources.direction)
            .style("-webkit-user-select", "none")
            .style("-moz-user-select", "none")
            .style("-ms-user-select", "none")
            .style("pointer-events", "none");
        text.append("tspan")
            .text(`${title}: `);
        text.append("tspan")
            .text(value);
        text.append("tspan")
            .text(units);
    }

    private setRouteColorToChart(routeColor: string) {
        let icon = IconsService.createRoundIcon(routeColor);
        this.chartElements.hoverChartMarker.setIcon(icon);
        this.chartElements.path.attr("stroke", routeColor);
        this.chartElements.hoverGroup.select(".circle-point").attr("fill", routeColor);
        this.chartElements.hoverGroup.select(".circle-point-aura").attr("stroke", routeColor);
    }

    private setDataToChart(data: [number, number][]) {
        let d3 = this.d3Service.getD3();
        let duration = 1000;
        this.chartElements.xScale.domain([d3.min(data, d => d[0]), d3.max(data, d => d[0])]);
        this.chartElements.yScale.domain([d3.min(data, d => d[1]), d3.max(data, d => d[1])]);
        let line = d3.line()
            .curve(d3.curveCatmullRom)
            .x(d => this.chartElements.xScale(d[0]))
            .y(d => this.chartElements.yScale(d[1]));
        let chartTransition = this.chartElements.chartArea.transition();
        chartTransition.select(".line").duration(duration).attr("d", line(data));
        chartTransition.select(".x.axis")
            .duration(duration)
            .call(d3.axisBottom(this.chartElements.xScale).ticks(5) as any);
        chartTransition.select(".y.axis")
            .call(d3.axisLeft(this.chartElements.yScale).ticks(5) as any)
            .duration(duration);
    }

    public toggleKmMarker($event: Event) {
        this.isKmMarkersOn = !this.isKmMarkersOn;
        this.updateKmMarkers();
    }

    private updateKmMarkers() {
        this.kmMarkersGroup.clearLayers();
        if (this.routeLayer == null) {
            return;
        }
        if (this.isKmMarkersOn === false) {
            return;
        }
        let routeData = this.routeLayer.getData();
        if (routeData.segments.length <= 0) {
            return;
        }

        let points = this.getKmPoints(routeData);
        for (let i = 0; i < points.length; i++) {
            this.kmMarkersGroup.addLayer(this.createKmMarker(points[i], i));
        }
    }

    private getKmPoints(routeData: Common.RouteData): L.LatLng[] {

        let length = 0;
        let start = routeData.segments[0].routePoint;
        let results = [start];
        let previousPoint = start;
        for (let segment of routeData.segments) {
            for (let latlng of segment.latlngs) {
                let currentDistance = previousPoint.distanceTo(latlng);
                length += currentDistance;
                if (length < 1000) {
                    previousPoint = latlng;
                    continue;
                }
                let markersToAdd = -1;
                while (length > 1000) {
                    length -= 1000;
                    markersToAdd++;
                }
                let ratio = (currentDistance - length - 1000 * markersToAdd) / currentDistance;
                results.push(this.interpolatePoint(previousPoint, latlng, ratio));
                for (let i = 1; i <= markersToAdd; i++) {
                    let currentRatio = (i * 1000) / currentDistance + ratio;
                    results.push(this.interpolatePoint(previousPoint, latlng, currentRatio));
                }
                previousPoint = latlng;
            }
        }
        return results;
    }

    private interpolatePoint(previousPoint: L.LatLng, currentPoint: L.LatLng, ratio: number): L.LatLng {
        return L.latLng(previousPoint.lat + (currentPoint.lat - previousPoint.lat) * ratio,
            previousPoint.lng + (currentPoint.lng - previousPoint.lng) * ratio);
    }

    private createKmMarker(latlng: L.LatLng, markerNumber: number): L.Marker {
        return L.marker(latlng, {
            clickable: false,
            draggable: false,
            icon: IconsService.createKmMarkerIcon(markerNumber)
        } as L.MarkerOptions);
    }

    public toggleExpand() {
        this.isExpanded = !this.isExpanded;
        this.changeDetectorRef.detectChanges();
        this.redrawChart();
    }

    private showSubRouteSelection = (point: IRouteStatisticsPoint) => {
        let dragEndXCoordinate = this.chartElements.xScale(point.x);
        let xStart = Math.min(this.chartElements.dragStartXCoordinate, dragEndXCoordinate);
        let xEnd = Math.max(this.chartElements.dragStartXCoordinate, dragEndXCoordinate);
        this.chartElements.dragRect.style("display", null)
            .attr("width", xEnd - xStart)
            .attr("x", xStart);

        let start = this.routeStatisticsService.interpolateStatistics(this.statistics, this.chartElements.xScale.invert(xStart));
        let end = this.routeStatisticsService.interpolateStatistics(this.statistics, this.chartElements.xScale.invert(xEnd));
        let statistics = this.routeStatisticsService.getStatisticsByRange(this.routesService.selectedRoute.getData(), start, end);
        this.initalizeStatistics(statistics);
    }

    private hideSubRouteSelection() {
        this.chartElements.dragRect.style("display", "none");
        this.chartElements.dragStartXCoordinate = null;
        this.initalizeStatistics(this.statistics);
    }
}