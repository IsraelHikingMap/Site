import { Component, ElementRef, ViewEncapsulation, OnInit, OnDestroy, HostListener } from "@angular/core";
import { Subscription } from "rxjs/Subscription";
import { Observable } from "rxjs/Rx";
import { ResourcesService } from "../services/ResourcesService";
import { MapService } from "../services/MapService";
import { LayersService } from "../services/layers/LayersService";
import { IRouteLayer } from "../services/layers/routelayers/IRouteLayer";
import { RouteStatisticsService, IRouteStatisticsPoint, IRouteStatistics } from "../services/RouteStatisticsService";
import { IconsService } from "../services/IconsService"
import { BaseMapComponent } from "./BaseMapComponent";
import * as _ from "lodash";
import * as $ from "jquery";

@Component({
    selector: "route-statistics-chart",
    templateUrl: "./routeStatisticsChart.html",
    styleUrls: [
        "./routeStatisticsChart.css",
        "../directives/draggableResizable.css",
    ],
    encapsulation: ViewEncapsulation.None,
})
export class RouteStatisticsChartComponent extends BaseMapComponent implements OnInit, OnDestroy {

    public isKmMarkersOn: boolean;
    public options: google.visualization.AreaChartOptions;
    public chartData: google.visualization.DataObject;
    public view: string[];

    private routeLayer: IRouteLayer;
    private hoverChartMarker: L.Marker;
    private kmMarkersGroup: L.LayerGroup;
    private hoverLine: Element;
    private statistics: IRouteStatistics;
    private routeLayerSubscriptions: Subscription[];
    private componentSubscriptions: Subscription[];
    /// chart:
    private chartWrapper: google.visualization.ChartWrapper;
    private chartSvg: JQuery;

    constructor(resources: ResourcesService,
        private layersService: LayersService,
        private mapService: MapService,
        private routeStatisticsService: RouteStatisticsService) {
        super(resources);
        this.routeLayer = null;
        this.statistics = null;
        this.chartWrapper = null;
        this.chartSvg = null;
        this.routeLayerSubscriptions = [];
        this.componentSubscriptions = [];
        this.kmMarkersGroup = L.layerGroup([] as L.Marker[]);
        this.initializeChart();
        this.hoverChartMarker = L.marker(mapService.map.getCenter(), { opacity: 0.0, draggable: false, clickable: false, keyboard: false } as L.MarkerOptions);
        this.mapService.map.addLayer(this.hoverChartMarker);
        this.mapService.map.addLayer(this.kmMarkersGroup);

        this.isKmMarkersOn = false;
        this.routeChanged();
    }

    public ngOnInit() 
    {
        this.componentSubscriptions.push(this.layersService.routeChanged.subscribe(() => {
            this.routeChanged();
        }));
        this.componentSubscriptions.push(this.routeStatisticsService.visibilityChanged.subscribe(() => {
            if (this.routeStatisticsService.isVisible) {
                setTimeout(() => this.onResize(), 300);
            }
        }));
        this.componentSubscriptions.push(this.resources.languageChanged.subscribe(() => {
            this.initOptions();
        }));
        this.onResize();
    }

    public ngOnDestroy() {
        for (let subscription of this.componentSubscriptions) {
            subscription.unsubscribe();
        }
        for (let subscription of this.routeLayerSubscriptions) {
            subscription.unsubscribe();
        }
    }

    @HostListener("window:resize", ["$event"])
    public onWindowResize(event: Event) {
        this.onResize();
    }

    public toggleKmMarker($event: Event) {
        this.suppressEvents($event);
        this.isKmMarkersOn = !this.isKmMarkersOn;
        this.updateKmMarkers();
    }

    public onChartReady = (chartWrapper: google.visualization.ChartWrapper) => {
        this.chartWrapper = chartWrapper;
        let container = $("#" + chartWrapper.getContainerId());
        this.hoverLine = container[0].getElementsByTagName("rect")[0].cloneNode(true) as Element;
        this.hoverLine.setAttribute("y", "10");
        this.hoverLine.setAttribute("z", "100");
        this.hoverLine.setAttribute("width", "1");
        this.hoverLine.setAttribute("stroke", "none");
        this.hoverLine.setAttribute("stroke-width", "0");
        this.hoverLine.setAttribute("fill", "white");
        this.hoverLine.setAttribute("class", "google-visualization-vertical-line");
    }

    public close(e: Event) {
        this.suppressEvents(e);
        this.routeStatisticsService.toggle();
    }

    public isOpen() {
        return this.routeStatisticsService.isVisible();
    }

    private routeChanged() {
        for (let subscription of this.routeLayerSubscriptions) {
            subscription.unsubscribe();
        }
        this.routeLayer = this.layersService.getSelectedRoute();
        this.onRouteDataChanged();
        if (this.routeLayer) {
            this.routeLayerSubscriptions.push(this.routeLayer.dataChanged.subscribe(this.onRouteDataChanged));
            this.routeLayerSubscriptions.push(this.routeLayer.polylineHovered.subscribe((latlng: L.LatLng) => this.onPolylineHover(latlng)));
        }
    }

    private onRouteDataChanged = () => {
        this.updateKmMarkers();
        this.updateChart();
    }

    private onPolylineHover(latlng: L.LatLng) {
        if (!this.chartWrapper || !this.statistics) {
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

    private onChartHoverOrClick(e: JQueryMouseEventObject): IRouteStatisticsPoint {
        if (!this.statistics) {
            return null;
        }
        var x = this.chartWrapper.getChart().getChartLayoutInterface().getHAxisValue(e.offsetX);
        if (x <= 0) {
            this.hideChartHover();
            return null;
        }
        let point = this.routeStatisticsService.interpolateStatistics(this.statistics, x);
        this.showChartHover(point);

        return point;
    }

    private createKmMarker(latlng: L.LatLng, markerNumber: number): L.Marker {
        return L.marker(latlng, {
            clickable: false,
            draggable: false,
            keyboard: false,
            icon: IconsService.createKmMarkerIcon(markerNumber)
        } as L.MarkerOptions);
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
        let markerNumber = 0;
        let length = 0;
        let start = routeData.segments[0].routePoint;
        this.kmMarkersGroup.addLayer(this.createKmMarker(start, markerNumber));
        let previousPoint = start;
        for (let segment of routeData.segments) {
            for (let latlng of segment.latlngs) {
                length += previousPoint.distanceTo(latlng);
                previousPoint = latlng;
                if (length < (markerNumber + 1) * 1000) {
                    continue;
                }
                markerNumber++;
                this.kmMarkersGroup.addLayer(this.createKmMarker(latlng, markerNumber));
            }
        }
    }

    private updateChart() {
        this.chartData.rows.splice(0);
        if (this.routeLayer == null) {
            return;
        }
        this.statistics = this.routeStatisticsService.getStatistics(this.routeLayer.getData());
        for (let point of this.statistics.points) {
            this.chartData.rows.push({
                c: [{ v: point.x } as google.visualization.DataObjectCell,
                { v: point.y } as google.visualization.DataObjectCell,
                { v: point.latlng.lat } as google.visualization.DataObjectCell,
                { v: point.latlng.lng } as google.visualization.DataObjectCell,
                { v: point.y } as google.visualization.DataObjectCell,
                { v: 0 } as google.visualization.DataObjectCell
                ]
            } as google.visualization.DataObjectRow);
        }

        this.initOptions();

        let routeColor = this.routeLayer.route.properties.pathOptions.color;
        var icon = IconsService.createRoundIcon(routeColor);
        this.hoverChartMarker.setIcon(icon);
    }

    private showChartHover(point: IRouteStatisticsPoint) {
        this.hideChartHover();
        if (!point) {
            return;
        }
        let offsetX = this.chartWrapper.getChart().getChartLayoutInterface().getXLocation(point.x);
        let tooltip = this.getChartTooltip(point);
        let tooltipCss = {
            position: "absolute",
            width: "140px",
            height: "70px",
            top: "5px"
        } as any;
        if (offsetX < this.chartSvg.width() / 2) {
            tooltipCss.left = (offsetX + 20) + "px";
        } else {
            tooltipCss.left = (offsetX - 30 - 140) + "px";
        }
        tooltip.css(tooltipCss);
        if (this.chartSvg.height() > 80) {
            let chartContainer = $(".route-statistics-chart");
            chartContainer.append(tooltip);
        }
        this.hoverLine.setAttribute("x", offsetX);
        this.hoverLine.setAttribute("height", this.chartSvg.height().toString());
        this.chartSvg.append(this.hoverLine);
    }

    private hideChartHover() {
        $(".google-visualization-tooltip").remove();
        $(".google-visualization-vertical-line").remove();
    }

    private getChartTooltip(point: IRouteStatisticsPoint): JQuery {
        return $(`<div class="google-visualization-tooltip chart-tooltip">
                        <ul class="google-visualization-tooltip-item-list">
                            <li class="google-visualization-tooltip-item">
                                <p class="text-${this.resources.start}" dir="${this.resources.direction}" style="color:black">
                                    ${this.resources.distance}: ${point.x.toFixed(2)} ${this.resources.kmUnit}<br/>
                                    ${this.resources.height}: ${point.y.toFixed(0)} ${this.resources.meterUnit}<br/>
                                    ${this.resources.slope}: <span dir="ltr">${point.slope.toFixed(0)}%</span>
                                </p>
                            </li>
                        </ul>
                    </div>`);
    }

    private initializeChart() {
        this.chartData = {
            cols: [
                {
                    id: "distance",
                    label: this.resources.distance,
                    type: "number"
                } as google.visualization.DataObjectColumn, {
                    id: "height",
                    label: this.resources.height,
                    type: "number"
                } as google.visualization.DataObjectColumn, {
                    id: "lat",
                    label: "Hidden",
                    type: "number"
                } as google.visualization.DataObjectColumn, {
                    id: "lng",
                    label: "Hidden",
                    type: "number"
                } as google.visualization.DataObjectColumn, {
                    id: "interval",
                    label: "interval-top",
                    type: "number",
                    role: "interval"
                } as google.visualization.DataObjectColumn, {
                    id: "interval",
                    label: "interval-bottom",
                    type: "number",
                    role: "interval"
                } as google.visualization.DataObjectColumn
            ],
            rows: [] as google.visualization.DataObjectRow[]
        } as google.visualization.DataObject;

        this.view = ["0", "1", "4", "5"];

        this.initOptions();
    }

    private initOptions() {
        let color = "white";
        let options = {
            isStacked: true,
            fill: 20,
            displayExactValues: true,
            legend: "none",
            curveType: "function",
            intervals: { style: "area" },
            enableInteractivity: false,
            tooltip: {
                trigger: "none"
            },
            chartArea: {
                left: 100,
                top: 10,
                width: "100%",
                height: "75%"
            } as google.visualization.ChartArea,
            backgroundColor: { fill: "transparent" },
            vAxis: {
                baselineColor: color,
                textStyle: { color: color },
                title: this.resources.heightInMeters,
                titleTextStyle: { color: color },
                viewWindowMode: "explicit",
                gridlines: {
                    color: "transparent"
                } as google.visualization.ChartGridlines
            } as google.visualization.ChartAxis,
            hAxis: {
                baselineColor: color,
                textStyle: { color: color },
                title: this.resources.distanceInKm,
                titleTextStyle: { color: color },
                format: "0.00",
                gridlines: {
                    color: "transparent"
                } as google.visualization.ChartGridlines
            } as google.visualization.ChartAxis
        } as google.visualization.AreaChartOptions;

        if (this.routeLayer && this.statistics) {
            let routeColor = this.routeLayer.route.properties.pathOptions.color;
            options.colors = [routeColor];
            if (this.statistics.points.length > 0) {
                let min = _.minBy(this.statistics.points, (pointToMin) => pointToMin.y).y;
                let max = _.maxBy(this.statistics.points, (pointToMax) => pointToMax.y).y;
                options.vAxis.viewWindow = {
                    min: min > 0 ? min * 0.9 : min * 1.1,
                    max: max > 0 ? max * 1.1 : max * 0.9
                } as google.visualization.ChartViewWindow;
            }
        }
        // import for chart update.
        this.options = options;
    }

    public onResize() {
        if (this.chartWrapper == null)
        {
            return;
        }
        this.chartWrapper.draw();
        this.afterChartUpdate();
    }

    public afterChartUpdate() {
        this.chartSvg = $(".route-statistics-chart svg");
        this.chartSvg.mousemove((e: JQueryMouseEventObject): false => {
            let point = this.onChartHoverOrClick(e);
            if (point != null) {
                this.hoverChartMarker.setLatLng(point.latlng);
                this.hoverChartMarker.setOpacity(1.0);
            }
            return false;
        });
        this.chartSvg.click((e: JQueryMouseEventObject): false => {
            // mainly for mobile devices
            this.onChartHoverOrClick(e);
            setTimeout(() => { this.hideChartHover() }, 2000);
            return false;
        });

        $(".route-statistics-body").mouseleave((e) => {
            this.hideChartHover();
            this.hoverChartMarker.setOpacity(0.0);
        });
    }
}