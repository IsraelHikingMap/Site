namespace IsraelHiking.Controllers {
    export interface IRouteStatisticsScope extends IRootScope {
        length: number;
        gain: number;
        loss: number;
        isKmMarkersOn: boolean;
        isShowingKmMarkers(): boolean;
        chart: any;
        toggleKmMarker($event: Event): void;
        getUnits(number: number): string;
        toShortNumber(number: number): string;
        onMouseOver(rowIndex: number, colIndex: number): void;
        onMouseOut(): void;
        onChartReady(chartWrapper: any): void
        toggle(e: Event): void;
        isOpen(): boolean;

    }

    export class RouteStatisticsController extends BaseMapController {

        private routeStatisticsService: Services.RouteStatisticsService;
        private resourcesService: Services.ResourcesService;
        private routeLayer: Services.Layers.RouteLayers.RouteLayer;
        private hoverChartMarker: L.Marker;
        private kmMarkersGroup: L.LayerGroup;
        private $compile: angular.ICompileService;
        private routeDataChangedEventHandler: (data: {}) => void;
        private polylineHoverEventHandler: (data: L.LatLng) => void;
        private chartWrapper: any;
        private chartSvg: JQuery;
        private layoutInterface: google.visualization.ChartLayoutInterface;
        private hoverLine: any;
        private statistics: Services.IRouteStatistics;

        constructor($scope: IRouteStatisticsScope,
            $window: angular.IWindowService,
            $timeout: angular.ITimeoutService,
            $compile: angular.ICompileService,
            layersService: Services.Layers.LayersService,
            mapService: Services.MapService,
            routeStatisticsService: Services.RouteStatisticsService) {
            super(mapService);

            this.routeStatisticsService = routeStatisticsService;
            this.resourcesService = $scope.resources;
            this.layoutInterface = null;
            this.routeLayer = null;
            this.statistics = null;
            this.chartSvg = null;
            this.kmMarkersGroup = L.layerGroup([] as L.Marker[]);
            this.$compile = $compile;
            this.initializeChart($scope);
            this.hoverChartMarker = L.marker(mapService.map.getCenter(), { opacity: 0.0, draggable: false, clickable: false, keyboard: false } as L.MarkerOptions);
            this.map.addLayer(this.hoverChartMarker);
            this.map.addLayer(this.kmMarkersGroup);
            this.routeDataChangedEventHandler = ({}) => this.onRouteDataChanged($scope);
            this.polylineHoverEventHandler = (latlng: L.LatLng) => this.onPolylineHover($scope, latlng);

            $scope.isKmMarkersOn = false;

            this.routeChanged($scope, layersService);

            layersService.routeChangedEvent.addListener(() => {
                this.routeChanged($scope, layersService);
            });

            $scope.toggleKmMarker = ($event: Event) => {
                this.suppressEvents($event);
                $scope.isKmMarkersOn = !$scope.isKmMarkersOn;
                this.updateKmMarkers($scope.isKmMarkersOn);
            }

            $scope.getUnits = (number: number): string => {
                return Math.abs(number) > 1000 ? $scope.resources.kmUnit : $scope.resources.meterUnit;
            };

            $scope.toShortNumber = (number: number) => {
                if (number == null) {
                    return "0";
                }
                return Math.abs(number) > 1000 ? (number / 1000.0).toFixed(2) : number.toFixed(0);
            }

            $scope.$on("angular-resizable.resizing", () => {
                $window.dispatchEvent(new Event("resize"));
            });

            // fixes issue with chart display on first load.
            $scope.$watch(() => routeStatisticsService.isVisible, () => {
                $window.dispatchEvent(new Event("resize"));
            }, true);

            $scope.$watch(() => $scope.resources.currentLanguage, () => {
                $scope.chart.options.vAxis.title = $scope.resources.heightInMeters;
                $scope.chart.options.hAxis.title = $scope.resources.distanceInKm;
            },true);

            $scope.onChartReady = (chartWrapper: any) => {
                this.chartWrapper = chartWrapper;
                this.layoutInterface = chartWrapper.getChart().getChartLayoutInterface();
                var container = angular.element(chartWrapper.getContainerId());

                this.hoverLine = container[0].getElementsByTagName("rect")[0].cloneNode(true);
                this.hoverLine.setAttribute("y", 10);
                this.hoverLine.setAttribute("z", 100);
                this.hoverLine.setAttribute("width", "1");
                this.hoverLine.setAttribute("stroke", "none");
                this.hoverLine.setAttribute("stroke-width", "0");
                this.hoverLine.setAttribute("fill", "white");
                this.hoverLine.setAttribute("class", "google-visualization-vertical-line");

                this.chartSvg = angular.element(".route-statistics-chart svg");
                this.chartSvg.mousemove((e) => {
                    let point = this.onChartHoverOrClick(e);
                    if (point != null) {
                        this.hoverChartMarker.setLatLng(point.latlngz);
                        this.hoverChartMarker.setOpacity(1.0);
                    }
                });
                this.chartSvg.click((e) => {
                    // mainly for mobile devices
                    this.onChartHoverOrClick(e);
                    $timeout(() => { this.hideChartHover() }, 2000);
                });

                angular.element(".route-statistics-body").mouseleave((e) => {
                    this.hideChartHover();
                    this.hoverChartMarker.setOpacity(0.0);
                });
            }

            $scope.toggle = (e: Event) => {
                this.suppressEvents(e);
                routeStatisticsService.toggle();
            }

            $scope.isOpen = () => {
                return routeStatisticsService.isVisible;
            }
        }

        private routeChanged = ($scope: IRouteStatisticsScope, layersService: Services.Layers.LayersService) => {
            if (this.routeLayer) {
                this.routeLayer.dataChangedEvent.removeListener(this.routeDataChangedEventHandler);
                this.routeLayer.polylineHoverEvent.removeListener(this.polylineHoverEventHandler);
            }
            this.routeLayer = layersService.getSelectedRoute();
            this.onRouteDataChanged($scope);
            if (this.routeLayer) {
                this.routeLayer.dataChangedEvent.addListener(this.routeDataChangedEventHandler);
                this.routeLayer.polylineHoverEvent.addListener(this.polylineHoverEventHandler);
            }
        }

        private onRouteDataChanged = ($scope: IRouteStatisticsScope) => {
            this.updateKmMarkers($scope.isKmMarkersOn);
            this.updateChart($scope);
        }

        private onPolylineHover = ($scope: IRouteStatisticsScope, latlng: L.LatLng) => {
            if (!this.chartWrapper || !this.statistics)
            {
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

        private onChartHoverOrClick(e: JQueryMouseEventObject): Services.IRouteStatisticsPoint {
            if (!this.statistics) {
                return null;
            }
            var x = this.layoutInterface.getHAxisValue(e.offsetX);
            if (x <= 0) {
                this.hideChartHover();
                return null;
            }
            let point = this.routeStatisticsService.interpolateStatistics(this.statistics, x);
            this.showChartHover(point);

            return point;
        }

        private createKmMarker = (latlng: L.LatLng, markerNumber: number): L.Marker => {
            return L.marker(latlng, {
                clickable: false,
                draggable: false,
                keyboard: false,
                icon: Services.IconsService.createKmMarkerIcon(markerNumber)
            } as L.MarkerOptions);
        }

        private updateKmMarkers(isKmMarkersOn: boolean) {
            this.kmMarkersGroup.clearLayers();
            if (this.routeLayer == null) {
                return;
            }
            if (isKmMarkersOn === false) {
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
                for (let latlngz of segment.latlngzs) {
                    length += previousPoint.distanceTo(latlngz);
                    previousPoint = latlngz;
                    if (length < (markerNumber + 1) * 1000) {
                        continue;
                    }
                    markerNumber++;
                    this.kmMarkersGroup.addLayer(this.createKmMarker(latlngz, markerNumber));
                }
            }
        }

        private updateChart = ($scope: IRouteStatisticsScope) => {
            $scope.chart.data.rows.splice(0);
            if (this.routeLayer == null) {
                return;
            }
            this.statistics = this.routeStatisticsService.getStatistics(this.routeLayer.getData());
            for (let point of this.statistics.points) {
                $scope.chart.data.rows.push({
                    c: [{ v: point.x } as google.visualization.DataObjectCell,
                        { v: point.y } as google.visualization.DataObjectCell,
                        { v: point.latlngz.lat } as google.visualization.DataObjectCell,
                        { v: point.latlngz.lng } as google.visualization.DataObjectCell,
                        { v: point.y } as google.visualization.DataObjectCell,
                        { v: 0 } as google.visualization.DataObjectCell
                    ]
                } as google.visualization.DataObjectRow);
            }
            let routeColor = this.routeLayer.getRouteProperties().pathOptions.color;
            $scope.chart.options.colors = [routeColor];
            if (this.statistics.points.length > 0) {
                let min = _.minBy(this.statistics.points, (pointToMin) => pointToMin.y).y;
                let max = _.maxBy(this.statistics.points, (pointToMax) => pointToMax.y).y;
                $scope.chart.options.vAxis.viewWindow = {
                    min: min > 0 ? min * 0.9 : min * 1.1,
                    max: max > 0 ? max * 1.1 : max * 0.9
                } as google.visualization.ChartViewWindow;
            }
            $scope.length = this.statistics.length;
            $scope.gain = this.statistics.gain;
            $scope.loss = this.statistics.loss;

            var icon = Services.IconsService.createRoundIcon(routeColor);
            this.hoverChartMarker.setIcon(icon);
        }

        private showChartHover(point: Services.IRouteStatisticsPoint) {
            this.hideChartHover();
            if (!point)
            {
                return;
            }
            let offsetX = this.layoutInterface.getXLocation(point.x);
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
                let chartContainer = angular.element(".route-statistics-chart");
                chartContainer.append(tooltip);
            }
            this.hoverLine.setAttribute("x", offsetX);
            this.chartSvg[0].appendChild(this.hoverLine);
        }

        private hideChartHover() {
            angular.element(".google-visualization-tooltip").remove();
            angular.element(".google-visualization-vertical-line").remove();
        }

        private getChartTooltip(point: Services.IRouteStatisticsPoint): JQuery {
            return angular.element(`<div class="google-visualization-tooltip chart-tooltip">
                        <ul class="google-visualization-tooltip-item-list">
                            <li class="google-visualization-tooltip-item">
                                <p class="text-${this.resourcesService.start}" dir="${this.resourcesService.direction}">
                                    ${this.resourcesService.distance}: ${point.x.toFixed(2)} ${this.resourcesService.kmUnit}<br/>
                                    ${this.resourcesService.height}: ${point.y.toFixed(0)} ${this.resourcesService.meterUnit}<br/>
                                    ${this.resourcesService.slope}: <span dir="ltr">${point.slope.toFixed(0)}%</span>
                                </p>
                            </li>
                        </ul>
                    </div>`);
        }

        private initializeChart = ($scope: IRouteStatisticsScope) => {
            let color = "white";
            $scope.chart = {};
            $scope.chart.type = "LineChart";
            $scope.chart.data = {
                cols: [
                    {
                        id: "distance",
                        label: $scope.resources.distance,
                        type: "number"
                    } as google.visualization.DataObjectColumn, {
                        id: "height",
                        label: $scope.resources.height,
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

            $scope.chart.options = {
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
                    title: $scope.resources.heightInMeters,
                    titleTextStyle: { color: color },
                    viewWindowMode: "explicit",
                    gridlines: {
                        color: "transparent"
                    } as google.visualization.ChartGridlines
                } as google.visualization.ChartAxis,
                hAxis: {
                    baselineColor: color,
                    textStyle: { color: color },
                    title: $scope.resources.distanceInKm,
                    titleTextStyle: { color: color },
                    format: "0.00",
                    gridlines: {
                        color: "transparent"
                    } as google.visualization.ChartGridlines
                } as google.visualization.ChartAxis
            } as google.visualization.AreaChartOptions;
            $scope.chart.view = {
                columns: [0, 1, 4, 5]
            }
            $scope.chart.formatters = {};
        }
    }
}