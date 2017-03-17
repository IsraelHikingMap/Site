﻿namespace IsraelHiking.Controllers {
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
        hide($event: Event): void;
    }

    export class RouteStatisticsController extends BaseMapController {

        private routeLayer: Services.Layers.RouteLayers.RouteLayer;
        private hoverChartMarker: L.Marker;
        private kmMarkersGroup: L.LayerGroup<L.Marker>;
        private $compile: angular.ICompileService;
        private routeDataChangedEventHandler: (data: {}) => void;

        constructor($scope: IRouteStatisticsScope,
            $window: angular.IWindowService,
            $timeout: angular.ITimeoutService,
            $compile: angular.ICompileService,
            layersService: Services.Layers.LayersService,
            mapService: Services.MapService,
            routeStatisticsService: Services.RouteStatisticsService) {
            super(mapService);

            this.routeLayer = null;
            this.kmMarkersGroup = L.layerGroup([] as L.Marker[]);
            this.$compile = $compile;
            this.initializeChart($scope);
            this.hoverChartMarker = L.marker(mapService.map.getCenter(), { opacity: 0.0 } as L.MarkerOptions);
            this.map.addLayer(this.hoverChartMarker);
            this.map.addLayer(this.kmMarkersGroup);
            this.routeDataChangedEventHandler = ({}) => this.onRouteDataChanged($scope);

            $scope.isKmMarkersOn = false;
            $scope.onMouseOver = (rowIndex: number) => {
                var row = $scope.chart.data.rows[rowIndex] as google.visualization.DataObjectRow;
                this.hoverChartMarker.setLatLng([row.c[2].v, row.c[3].v]);
                this.hoverChartMarker.setOpacity(1.0);
            };

            $scope.onMouseOut = () => {
                this.hoverChartMarker.setOpacity(0.0);
            };

            this.routeChanged($scope, layersService);

            layersService.routeChangedEvent.addListener(() => {
                this.routeChanged($scope, layersService);
            });

            $scope.toggleKmMarker = ($event: Event) => {
                this.suppressEvents($event);
                $scope.isKmMarkersOn = !$scope.isKmMarkersOn;
                this.updateKmMarkers($scope.isKmMarkersOn);
            }

            $scope.hide = ($event: Event) => {
                this.suppressEvents($event);
                routeStatisticsService.hide();
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

            // fixes issue with chart display on firt load.
            $scope.$watch(() => routeStatisticsService.isVisible, () => {
                $window.dispatchEvent(new Event("resize"));
            }, true);

            $scope.$watch(() => $scope.resources.currentLanguage, () => {
                $scope.chart.options.vAxis.title = $scope.resources.heightInMeters;
                $scope.chart.options.hAxis.title = $scope.resources.distanceInKm;
            },true);

            
        }

        private routeChanged = ($scope: IRouteStatisticsScope, layersService: Services.Layers.LayersService) => {
            if (this.routeLayer) {
                this.routeLayer.eventHelper.removeListener(this.routeDataChangedEventHandler);
            }
            this.routeLayer = layersService.getSelectedRoute();
            this.onRouteDataChanged($scope);
            if (this.routeLayer) {
                this.routeLayer.eventHelper.addListener(this.routeDataChangedEventHandler);
            }
        }

        private onRouteDataChanged = ($scope: IRouteStatisticsScope) => {
            this.updateKmMarkers($scope.isKmMarkersOn);
            this.updateChart($scope);
        }

        private createKmMarker = (latlng: L.LatLng, markerNumber: number): L.Marker => {
            return L.marker(latlng, {
                clickable: false,
                draggable: false,
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
            $scope.chart.data.rows.splice(0, $scope.chart.data.rows.length);
            if (this.routeLayer == null) {
                return;
            }
            var statistics = this.routeLayer.getStatistics();
            for (let point of statistics.points) {
                $scope.chart.data.rows.push({
                    c: [{ v: point.x } as google.visualization.DataObjectCell,
                        { v: point.y } as google.visualization.DataObjectCell,
                        { v: point.latlng.lat } as google.visualization.DataObjectCell,
                        { v: point.latlng.lng } as google.visualization.DataObjectCell,
                        { v: point.y } as google.visualization.DataObjectCell,
                        { v: 0 } as google.visualization.DataObjectCell,
                        { v: this.getChartTooltip($scope, point) } as google.visualization.DataObjectCell]
                } as google.visualization.DataObjectRow);
            }
            let routeColor = this.routeLayer.getRouteProperties().pathOptions.color;
            $scope.chart.options.colors = [routeColor];
            if (statistics.points.length > 0) {
                let min = _.minBy(statistics.points, (pointToMin) => pointToMin.y).y;
                let max = _.maxBy(statistics.points, (pointToMax) => pointToMax.y).y;
                $scope.chart.options.vAxis.viewWindow = {
                    min: min > 0 ? min * 0.9 : min * 1.1,
                    max: max > 0 ? max * 1.1 : max * 0.9
                } as google.visualization.ChartViewWindow;
            }
            $scope.length = statistics.length;
            $scope.gain = statistics.gain;
            $scope.loss = statistics.loss;

            var icon = Services.IconsService.createRoundIcon(routeColor);
            this.hoverChartMarker.setIcon(icon);
        }

        private getChartTooltip($scope: IRouteStatisticsScope, point: Services.Layers.RouteLayers.IRouteStatisticsPoint) {
            return `<div class="chart-tooltip"><p class="text-${$scope.resources.start}" dir="${$scope.resources.direction}">` +
                `${$scope.resources.distance}: ${point.x.toFixed(2)} ${$scope.resources.kmUnit}<br/>` +
                `${$scope.resources.height}: ${point.y.toFixed(0)} ${$scope.resources.meterUnit}<br/>` +
                `${$scope.resources.slope}: <span dir="ltr">${point.slope.toFixed(0)}%</span>` +
                `</p></div>`;
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
                    } as google.visualization.DataObjectColumn, {
                        id: "tooltip",
                        label: "tooltip",
                        type: "string",
                        role: "tooltip",
                        p: { html: true }
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
                tooltip: { isHtml: true },
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
                columns: [0, 1, 4, 5, 6]
            }
            $scope.chart.formatters = {};
        }
    }
}