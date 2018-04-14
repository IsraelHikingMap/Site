import { Component, ViewEncapsulation, OnInit, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef } from "@angular/core";
import { trigger, style, transition, animate } from "@angular/animations";
import { Subscription } from "rxjs/Subscription";
import { D3Service, Selection, BaseType, ScaleContinuousNumeric } from "d3-ng2-service";
import * as L from "leaflet";

import { RoutesService } from "../services/layers/routelayers/routes.service";
import { ResourcesService } from "../services/resources.service";
import { RouteStatisticsService, IRouteStatistics, IRouteStatisticsPoint } from "../services/route-statistics.service";
import { BaseMapComponent } from "./base-map.component";
import { RouteStatisticsChartTooltipComponent } from "./route-statistics-chart-tooltip.component";
import { IRouteLayer } from "../services/layers/routelayers/iroute.layer";
import { MapService } from "../services/map.service";
import { IconsService } from "../services/icons.service";
import * as Common from "../common/IsraelHiking";

interface IMargin {
    top: number;
    bottom: number;
    left: number;
    right: number;
}

interface IChartElements {
    svg: Selection<any, {}, null, undefined>;
    chartArea: Selection<BaseType, {}, null, undefined>;
    hoverLine: Selection<BaseType, {}, null, undefined>;
    xScale: ScaleContinuousNumeric<number, number>;
    yScale: ScaleContinuousNumeric<number, number>;
    hoverChartMarker: L.Marker;
    margin: IMargin;
    width: number;
    height: number;
}

@Component({
    selector: "route-statistics",
    templateUrl: "./route-statistics.component.html",
    styleUrls: ["./route-statistics.component.css"],
    encapsulation: ViewEncapsulation.None,
    animations: [
        trigger(
            "animateChart",
            [
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
    public length: number;
    public gain: number;
    public loss: number;
    public isKmMarkersOn: boolean;

    @ViewChild("lineChartContainer")
    public lineChartContainer: ElementRef;

    @ViewChild("tooltip")
    public tooltip: RouteStatisticsChartTooltipComponent;

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
        ) {
        super(resources);

        this.isKmMarkersOn = false;
        this.routeLayer = null;
        this.statistics = null;
        this.initalizeStatistics();
        this.routeLayerSubscriptions = [];
        this.componentSubscriptions = [];
        this.kmMarkersGroup = L.layerGroup([] as L.Marker[]);
        this.chartElements = {
            margin: { top: 20, right: 20, bottom: 40, left: 70 },
            hoverChartMarker: L.marker(mapService.map.getCenter(), { opacity: 0.0, draggable: false, clickable: false } as L.MarkerOptions)
        } as IChartElements;
        this.mapService.map.addLayer(this.chartElements.hoverChartMarker);
        this.mapService.map.addLayer(this.kmMarkersGroup);
    }

    private initalizeStatistics(): void {
        this.length = 0;
        this.gain = 0;
        this.loss = 0;
    }

    public ngOnInit() {
        this.componentSubscriptions.push(this.routesService.routeChanged.subscribe(() => {
            this.routeChanged();
        }));
        this.componentSubscriptions.push(this.resources.languageChanged.subscribe(() => {
            this.drawChart();
        }));
        this.routeChanged();
    }

    public ngOnDestroy() {
        for (let subscription of this.componentSubscriptions) {
            subscription.unsubscribe();
        }
        for (let subscription of this.routeLayerSubscriptions) {
            subscription.unsubscribe();
        }
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
            this.drawChart();
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
        this.initalizeStatistics();
        if (this.routeLayer) {
            this.onRouteDataChanged();
            this.routeLayerSubscriptions.push(this.routeLayer.dataChanged.subscribe(this.onRouteDataChanged));
            this.routeLayerSubscriptions.push(this.routeLayer.polylineHovered.subscribe((latlng: L.LatLng) => this.onPolylineHover(latlng)));
        }
    }

    private onRouteDataChanged = () => {
        this.statistics = this.routeStatisticsService.getStatistics(this.routesService.selectedRoute.getData());
        this.length = this.statistics.length;
        this.gain = this.statistics.gain;
        this.loss = this.statistics.loss;
        this.drawChart();
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

    private drawChart = () => {
        if (!this.isVisible()) {
            return;
        }
        if (!this.lineChartContainer.nativeElement) {
            return;
        }
        if (this.statistics == null) {
            return;
        }
        let data = [];
        for (let point of this.statistics.points) {
            data.push([point.x, point.y]);
        }
        let routeColor = this.routeLayer.route.properties.pathOptions.color;
        var icon = IconsService.createRoundIcon(routeColor);
        this.chartElements.hoverChartMarker.setIcon(icon);

        this.initChart(data);
        this.createChartAxis();
        this.drawChartLine(data, routeColor);
        this.addChartHoverSupport();
    }

    private hideChartHover() {
        this.tooltip.hidden = true;
        this.chartElements.hoverLine.style("display", "none");
        this.chartElements.hoverChartMarker.setOpacity(0.0);
    }

    private showChartHover(point: IRouteStatisticsPoint) {
        if (!point) {
            this.hideChartHover();
            return;
        }
        let chartXCoordinate = this.chartElements.xScale(point.x);
        this.chartElements.hoverLine.style("display", null);
        this.chartElements.hoverLine.attr("x", chartXCoordinate);
        this.tooltip.point = point;
        this.tooltip.hidden = false;
        this.changeDetectorRef.detectChanges();
        if (chartXCoordinate < +this.chartElements.svg.attr("width") / 2) {
            this.tooltip.setPosition(chartXCoordinate + this.chartElements.margin.left + 20);
        } else {
            let tooltipWidth = this.tooltip.getWidth();
            this.tooltip.setPosition(chartXCoordinate + this.chartElements.margin.left - tooltipWidth - 20);
        }
        this.chartElements.hoverChartMarker.setLatLng(point.latlng);
        this.chartElements.hoverChartMarker.setOpacity(1.0);
    }

    public onMuoseMoveOrClick = () => {
        let d3 = this.d3Service.getD3();
        d3.event.stopPropagation();
        let coordinates = d3.mouse(this.chartElements.svg.node());
        let chartXCoordinate = coordinates[0] - this.chartElements.margin.left;
        let xPosition = this.chartElements.xScale.invert(chartXCoordinate);
        let point = this.routeStatisticsService.interpolateStatistics(this.statistics, xPosition);
        this.showChartHover(point);
    }

    private initChart(data: number[][]) {
        let d3 = this.d3Service.getD3();
        this.chartElements.svg = d3.select(this.lineChartContainer.nativeElement);
        this.chartElements.svg.html("");
        let width = +this.chartElements.svg.attr("width");
        let height = +this.chartElements.svg.attr("height");
        if (window.innerWidth - 50 < width) {
            width = window.innerWidth - 50;
            this.chartElements.svg.attr("width", width);
            height = 100;
            this.chartElements.svg.attr("height", height);
        }
        this.chartElements.width = width - this.chartElements.margin.left - this.chartElements.margin.right;
        this.chartElements.height = height - this.chartElements.margin.top - this.chartElements.margin.bottom;
        this.chartElements.chartArea = this.chartElements.svg.append("g").attr("transform", `translate(${this.chartElements.margin.left},${this.chartElements.margin.top})`);
        this.chartElements.xScale = d3.scaleLinear().domain([d3.min(data, d => d[0]), d3.max(data, d => d[0])]).range([0, this.chartElements.width]);
        this.chartElements.yScale = d3.scaleLinear().domain([d3.min(data, d => d[1]), d3.max(data, d => d[1])]).range([this.chartElements.height, 0]);
    }

    private createChartAxis() {
        let d3 = this.d3Service.getD3();
        // X Axis
        this.chartElements.chartArea.append("g")
            .attr("transform", `translate(0,${this.chartElements.height})`)
            .call(d3.axisBottom(this.chartElements.xScale))
            .append("text")
            .attr("fill", "#000")
            .attr("text-anchor", "middle")
            .attr("transform", `translate(${this.chartElements.width / 2},30)`)
            .attr("dir", this.resources.direction)
            .text(this.resources.distanceInKm)
            .select(".domain")
            .remove();

        // Y Axis
        this.chartElements.chartArea.append("g")
            .call(d3.axisLeft(this.chartElements.yScale).ticks(5))
            .append("text")
            .attr("fill", "#000")
            .attr("transform", `translate(-30, ${this.chartElements.height / 2}) rotate(-90)`)
            .attr("text-anchor", "middle")
            .attr("dir", this.resources.direction)
            .text(this.resources.heightInMeters);
    }

    private drawChartLine(data: number[][], routeColor: string) {
        // Line
        let d3 = this.d3Service.getD3();
        let line = d3.line()
            .curve(d3.curveCatmullRom)
            .x(d => this.chartElements.xScale(d[0]))
            .y(d => this.chartElements.yScale(d[1]));

        this.chartElements.chartArea.append("path")
            .datum(data)
            .attr("fill", "none")
            .attr("stroke", routeColor)
            .attr("stroke-linejoin", "round")
            .attr("stroke-linecap", "round")
            .attr("stroke-width", 2)
            .attr("d", line);
    }

    private addChartHoverSupport() {
        this.chartElements.hoverLine = this.chartElements.chartArea.append("rect");
        this.chartElements.hoverLine.attr("y", 0)
            .attr("x", 0)
            .attr("width", "0.1")
            .attr("height", this.chartElements.height)
            .attr("stroke", "black")
            .style("display", "none");

        this.chartElements.chartArea.append("rect")
            .attr("width", this.chartElements.width)
            .attr("height", this.chartElements.height)
            .style("fill", "none")
            .style("stroke", "none")
            .style("pointer-events", "all")
            .on("mousemove", () => {
                this.onMuoseMoveOrClick();
            })
            .on("click", () => {
                this.onMuoseMoveOrClick();
                setTimeout(() => {
                        this.hideChartHover();
                    },
                    2000);
            })
            .on("mouseout", () => {
                this.hideChartHover();
            });
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
}