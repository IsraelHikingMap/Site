import { Component, ViewEncapsulation, OnInit, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef } from "@angular/core";
import { trigger, style, transition, animate } from "@angular/animations";
import { Subscription, Observable } from "rxjs";
import { NgxD3Service, Selection, BaseType, ScaleContinuousNumeric } from "ngx-d3";
import { select } from "@angular-redux/store";

import { SelectedRouteService } from "../services/layers/routelayers/selected-route.service";
import { ResourcesService } from "../services/resources.service";
import { RouteStatisticsService, IRouteStatistics, IRouteStatisticsPoint } from "../services/route-statistics.service";
import { BaseMapComponent } from "./base-map.component";
import { CancelableTimeoutService } from "../services/cancelable-timeout.service";
import { SidebarService } from "../services/sidebar.service";
import { SpatialService } from "../services/spatial.service";
import { RunningContextService } from "../services/running-context.service";
import { LatLngAlt, RouteData, ApplicationState } from "../models/models";
import { GeoLocationService } from "../services/geo-location.service";

declare type DragState = "start" | "drag" | "none";

interface IMargin {
    top: number;
    bottom: number;
    left: number;
    right: number;
}

interface IChartSubRouteRange {
    xStart: number;
    xEnd: number;
}

interface IChartElements {
    svg: Selection<any, {}, null, undefined>;
    chartArea: Selection<SVGGElement, {}, null, undefined>;
    path: Selection<SVGPathElement, {}, null, undefined>;
    hoverGroup: Selection<BaseType, {}, null, undefined>;
    dragRect: Selection<BaseType, {}, null, undefined>;
    xScale: ScaleContinuousNumeric<number, number>;
    yScale: ScaleContinuousNumeric<number, number>;
    margin: IMargin;
    width: number;
    height: number;
    dragState: DragState;
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
export class RouteStatisticsComponent extends BaseMapComponent implements OnInit, OnDestroy {
    private static readonly HOVER_BOX_WIDTH = 160;

    public length: number;
    public gain: number;
    public loss: number;
    public duration: string;
    public durationUnits: string;
    public averageSpeed: number;
    public currentSpeed: number;
    public isKmMarkersOn: boolean;
    public isExpanded: boolean;
    public isTable: boolean;
    public isVisible: boolean;
    public kmMarkersSource: GeoJSON.FeatureCollection<GeoJSON.Point>;
    public chartHoverSource: GeoJSON.FeatureCollection<GeoJSON.Point>;
    public subRouteRange: IChartSubRouteRange;

    @ViewChild("lineChartContainer")
    public lineChartContainer: ElementRef;

    @select((state: ApplicationState) => state.routes.present)
    private routes$: Observable<RouteData[]>;

    @select((state: ApplicationState) => state.routeEditingState.selectedRouteId)
    private selectedRouteId$: Observable<string>;

    @select((state: ApplicationState) => state.location.zoom)
    private zoom$: Observable<number>;

    private statistics: IRouteStatistics;
    private chartElements: IChartElements;
    private componentSubscriptions: Subscription[];
    private zoom: number;
    private routeColor: string;

    constructor(resources: ResourcesService,
        private readonly changeDetectorRef: ChangeDetectorRef,
        private readonly d3Service: NgxD3Service,
        private readonly selectedRouteService: SelectedRouteService,
        private readonly routeStatisticsService: RouteStatisticsService,
        private readonly cancelableTimeoutService: CancelableTimeoutService,
        private readonly sidebarService: SidebarService,
        private readonly runningContextService: RunningContextService,
        private readonly geoLocationService: GeoLocationService
    ) {
        super(resources);
        this.isKmMarkersOn = false;
        this.isExpanded = false;
        this.isVisible = false;
        this.isTable = false;
        this.statistics = null;
        this.subRouteRange = null;
        this.initializeStatistics(null);
        this.componentSubscriptions = [];
        this.kmMarkersSource = {
            type: "FeatureCollection",
            features: []
        };
        this.chartHoverSource = {
            type: "FeatureCollection",
            features: []
        };
        this.chartElements = {
            margin: { top: 10, right: 10, bottom: 40, left: 40 },
        } as IChartElements;
        this.zoom = 7;
        this.zoom$.subscribe((zoom) => {
            this.zoom = zoom;
            this.updateKmMarkers();
        });
        this.componentSubscriptions.push(this.sidebarService.sideBarStateChanged.subscribe(() => {
            this.redrawChart();
        }));
    }

    private initializeStatistics(statistics: IRouteStatistics): void {
        if (statistics == null) {
            this.length = 0;
            this.gain = 0;
            this.loss = 0;
            this.duration = "--:--";
            this.durationUnits = "";
            this.currentSpeed = null;
            this.averageSpeed = null;
        } else {
            this.length = statistics.length;
            this.gain = statistics.gain;
            this.loss = statistics.loss;
            this.averageSpeed = statistics.averageSpeed;
            if (!statistics.duration) {
                this.duration = "--:--";
                this.durationUnits = "";
            } else {
                if (statistics.duration > 60 * 60) {
                    let hours = Math.floor(statistics.duration / (60 * 60));
                    let minutes = Math.floor((statistics.duration % (60 * 60)) / 60);
                    this.duration = this.toTwoDigits(hours) + ":" + this.toTwoDigits(minutes);
                    this.durationUnits = this.resources.hourUnit;
                } else {
                    let minutes = Math.floor(statistics.duration / 60);
                    let seconds = Math.floor(statistics.duration % 60);
                    this.duration = this.toTwoDigits(minutes) + ":" + this.toTwoDigits(seconds);
                    this.durationUnits = this.resources.minuteUnit;
                }
            }
        }
    }

    private toTwoDigits(value: number): string {
        let str = value.toString();
        if (str.length === 1) {
            str = `0${str}`;
        }
        return str;
    }

    public ngOnInit() {
        this.componentSubscriptions.push(this.routes$.subscribe(() => {
            this.routeChanged();
        }));
        this.componentSubscriptions.push(this.selectedRouteId$.subscribe(() => {
            this.routeChanged();
        }));
        this.componentSubscriptions.push(this.resources.languageChanged.subscribe(() => {
            this.redrawChart();
        }));
        this.componentSubscriptions.push(this.geoLocationService.positionChanged.subscribe(p => {
            this.currentSpeed = (p == null) ? null : p.coords.speed * 3.6;
        }));
        this.routeChanged();
    }

    public ngOnDestroy() {
        for (let subscription of this.componentSubscriptions) {
            subscription.unsubscribe();
        }
    }

    public changeState(state: string) {
        switch (state) {
            case "table":
                if (this.isTable) {
                    this.toggle();
                } else {
                    this.isTable = true;
                }
                break;
            case "graph":
                if (!this.isTable) {
                    this.toggle();
                } else {
                    this.isTable = false;
                    this.redrawChart();
                }
        }
    }

    public isSidebarVisible() {
        return this.sidebarService.isSidebarOpen();
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

    public toggle(): void {
        this.isVisible = !this.isVisible;
        if (this.isVisible) {
            this.redrawChart();
        } else {
            this.clearSubRouteSelection();
        }
    }

    private routeChanged() {
        this.initializeStatistics(null);
        this.updateKmMarkers();
        this.setDataToChart([]);
        this.onRouteDataChanged();
    }

    private onRouteDataChanged = () => {
        let selectedRoute = this.selectedRouteService.getSelectedRoute();
        if (!selectedRoute) {
            return;
        }
        this.statistics = this.routeStatisticsService.getStatistics(selectedRoute);
        this.initializeStatistics(this.statistics);
        if (this.isVisible) {
            this.clearSubRouteSelection();
            this.setRouteColorToChart(selectedRoute.color);
            this.setDataToChart(this.statistics.points.map(p => p.coordinate));
        }
        this.updateKmMarkers();
    }

    public redrawChart = () => {
        this.changeDetectorRef.detectChanges();
        if (!this.isVisible) {
            return;
        }
        if (!this.lineChartContainer || !this.lineChartContainer.nativeElement) {
            return;
        }
        let data = [];
        let routeColor = "black";
        let selectedRoute = this.selectedRouteService.getSelectedRoute();
        if (this.statistics != null && selectedRoute) {
            data = this.statistics.points.map(p => p.coordinate);
            routeColor = selectedRoute.color;
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
        this.updateSubRouteSelectionOnChart();
    }

    private hideChartHover() {
        this.chartElements.hoverGroup.style("display", "none");
        this.chartHoverSource = {
            type: "FeatureCollection",
            features: []
        };
    }

    private showChartHover(point: IRouteStatisticsPoint) {
        if (!point) {
            this.hideChartHover();
            return;
        }
        let chartXCoordinate = this.chartElements.xScale(point.coordinate[0]);
        let chartYCoordinate = this.chartElements.yScale(point.coordinate[1]);
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
        this.chartHoverSource = {
            type: "FeatureCollection",
            features: [{
                type: "Feature",
                properties: { color: this.routeColor },
                geometry: {
                    type: "Point",
                    coordinates: [point.latlng.lng, point.latlng.lat]
                }
            }]
        };
    }

    private onMouseDown = () => {
        this.chartElements.dragState = "start";
        let d3 = this.d3Service.getD3();
        this.subRouteRange = {
            xStart: this.chartElements.xScale.invert(d3.mouse(this.chartElements.chartArea.node())[0]),
            xEnd: null
        };
    }

    private onMouseMove = () => {
        let d3 = this.d3Service.getD3();
        d3.event.stopPropagation();
        let chartXCoordinate = d3.mouse(this.chartElements.chartArea.node())[0];
        let xPosition = this.chartElements.xScale.invert(chartXCoordinate);
        if (this.chartElements.dragState === "none") {
            let point = this.routeStatisticsService.interpolateStatistics(this.statistics, xPosition);
            this.showChartHover(point);
            this.updateSubRouteSelectionOnChart();
            return;
        }
        if (this.chartElements.dragState === "start") {
            this.chartElements.dragState = "drag";
        }
        if (this.chartElements.dragState === "drag") {
            this.subRouteRange.xEnd = xPosition;
            this.updateSubRouteSelectionOnChart();
            this.hideChartHover();
        }

    }

    private onMouseUp() {
        if (this.chartElements.dragState === "drag") {
            this.chartElements.dragState = "none";
            return;
        }
        // click
        this.chartElements.dragState = "none";
        this.clearSubRouteSelection();
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
        this.chartElements.dragState = "none";
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
                this.onMouseDown();
            })
            .on("mousemove touchmove", () => {
                this.onMouseMove();
            })
            .on("mouseup touchend", () => {
                this.onMouseUp();
            })
            .on("mouseout", () => {
                this.hideChartHover();
            });
    }

    private buildAllTextInHoverBox(point: IRouteStatisticsPoint) {
        this.chartElements.hoverGroup.selectAll("text").remove();
        this.createHoverBoxText(this.resources.distance, point.coordinate[0].toFixed(2), " " + this.resources.kmUnit, 20);
        this.createHoverBoxText(this.resources.height, point.coordinate[1].toFixed(0), " " + this.resources.meterUnit, 40, true);
        if (this.resources.direction === "rtl") {
            // the following is a hack due to bad svg presentation...
            this.createHoverBoxText(this.resources.slope, Math.abs(point.slope).toFixed(0) + "%", point.slope < 0 ? "-" : "", 60);
        } else {
            this.createHoverBoxText(this.resources.slope, point.slope.toFixed(0) + "%", "", 60);
        }

    }

    private createHoverBoxText(title: string, value: string, units: string, y: number, useBidi = false) {
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
        let valueSpan = text.append("tspan");
        if (useBidi) {
            valueSpan.attr("unicode-bidi", "embed").attr("direction", "ltr");
        }
        valueSpan.text(value);
        text.append("tspan")
            .text(units);
    }

    private setRouteColorToChart(routeColor: string) {
        this.routeColor = routeColor;
        this.chartElements.path.attr("stroke", routeColor);
        this.chartElements.hoverGroup.select(".circle-point").attr("fill", routeColor);
        this.chartElements.hoverGroup.select(".circle-point-aura").attr("stroke", routeColor);
    }

    private setDataToChart(data: [number, number][]) {
        if (!this.isVisible) {
            return;
        }
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

    public toggleKmMarker() {
        this.isKmMarkersOn = !this.isKmMarkersOn;
        this.updateKmMarkers();
    }

    private updateKmMarkers() {
        this.kmMarkersSource = {
            type: "FeatureCollection",
            features: []
        };
        let selectedRoute = this.selectedRouteService.getSelectedRoute();
        if (selectedRoute == null) {
            return;
        }
        if (this.isKmMarkersOn === false) {
            return;
        }
        if (selectedRoute.segments.length <= 0) {
            return;
        }

        let points = this.getKmPoints(selectedRoute);
        let features = [];
        for (let i = 0; i < points.length; i++) {
            features.push({
                type: "Feature",
                properties: { label: (i * this.getMarkerDistance()).toString() },
                geometry: {
                    type: "Point",
                    coordinates: [points[i].lng, points[i].lat]
                }
            });
        }
        this.kmMarkersSource = {
            type: "FeatureCollection",
            features: features
        };
    }

    private getKmPoints(routeData: RouteData): LatLngAlt[] {

        let length = 0;
        let markersDistance = this.getMarkerDistance() * 1000;
        let start = routeData.segments[0].routePoint;
        let results = [start];
        let previousPoint = start;
        for (let segment of routeData.segments) {
            for (let latlng of segment.latlngs) {
                let currentDistance = SpatialService.getDistanceInMeters(previousPoint, latlng);
                length += currentDistance;
                if (length < markersDistance) {
                    previousPoint = latlng;
                    continue;
                }
                let markersToAdd = -1;
                while (length > markersDistance) {
                    length -= markersDistance;
                    markersToAdd++;
                }
                let ratio = (currentDistance - length - markersDistance * markersToAdd) / currentDistance;
                results.push(SpatialService.getLatlngInterpolatedValue(previousPoint, latlng, ratio));
                for (let i = 1; i <= markersToAdd; i++) {
                    let currentRatio = (i * markersDistance) / currentDistance + ratio;
                    results.push(SpatialService.getLatlngInterpolatedValue(previousPoint, latlng, currentRatio));
                }
                previousPoint = latlng;
            }
        }
        return results;
    }

    private getMarkerDistance(): number {
        if (this.zoom < 7) {
            return 100;
        }
        if (this.zoom < 9) {
            return 50;
        }
        if (this.zoom < 11) {
            return 10;
        }
        if (this.zoom < 13) {
            return 5;
        }
        return 1;
    }

    public toggleExpand() {
        this.isExpanded = !this.isExpanded;
        this.redrawChart();
    }

    private updateSubRouteSelectionOnChart = () => {
        if (this.subRouteRange == null) {
            this.clearSubRouteSelection();
            return;
        }
        let xStart = this.chartElements.xScale(Math.min(this.subRouteRange.xStart, this.subRouteRange.xEnd));
        let xEnd = this.chartElements.xScale(Math.max(this.subRouteRange.xStart, this.subRouteRange.xEnd));
        this.chartElements.dragRect.style("display", null)
            .attr("width", xEnd - xStart)
            .attr("x", xStart);

        let start = this.routeStatisticsService.interpolateStatistics(this.statistics, this.chartElements.xScale.invert(xStart));
        let end = this.routeStatisticsService.interpolateStatistics(this.statistics, this.chartElements.xScale.invert(xEnd));
        let statistics = this.routeStatisticsService.getStatisticsByRange(this.selectedRouteService.getSelectedRoute(), start, end);
        this.initializeStatistics(statistics);
    }

    public clearSubRouteSelection() {
        this.chartElements.dragRect.style("display", "none");
        this.subRouteRange = null;
        this.initializeStatistics(this.statistics);
    }
}