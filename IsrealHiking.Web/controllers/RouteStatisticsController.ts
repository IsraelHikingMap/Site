module IsraelHiking.Controllers {
    export interface IRouteStatisticsScope extends angular.IScope {
        length: string;
        gain: string;
        loss: string;
        isKmMarkersOn: boolean;
        isShowingKmMarkers(): boolean;
        toggleKmMarker(): void;
        onMouseOver(rowIndex: number, colIndex: number);
        onMouseOut();
        chart: any;
    }

    export class RouteStatisticsController {

        private drawingRoute: Services.Drawing.DrawingRoute;
        private hoverChartMarker: L.Marker;

        constructor($scope: IRouteStatisticsScope,
            layersService: Services.LayersService,
            mapService: Services.MapService) {

            $scope.chart = {};
            $scope.chart.type = "LineChart";
            $scope.chart.data = {
                cols: [
                    {
                        id: "distance",
                        label: "Distance",
                        type: "number"
                    } as google.visualization.DataObjectColumn, {
                        id: "height",
                        label: "Height",
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
                    left: 50,
                    top: 10,
                    width: "100%",
                    height: "75%"
                } as google.visualization.ChartArea,
                backgroundColor: { fill: "transparent" },
                vAxis: {
                    title: "Height (m)",
                    viewWindowMode: "explicit",
                    gridlines: {
                        color: "transparent"
                    } as google.visualization.ChartGridlines
                } as google.visualization.ChartAxis,
                hAxis: {
                    title: "Distance (Km)",
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

            this.hoverChartMarker = L.marker(mapService.map.getCenter(), { opacity: 0.0 } as L.MarkerOptions);
            mapService.map.addLayer(this.hoverChartMarker);
            $scope.onMouseOver = (rowIndex: number) => {
                var row = $scope.chart.data.rows[rowIndex] as google.visualization.DataObjectRow;
                this.hoverChartMarker.setLatLng([row.c[2].v, row.c[3].v]);
                this.hoverChartMarker.setOpacity(1.0);
            };

            $scope.onMouseOut = () => {
                this.hoverChartMarker.setOpacity(0.0);
            };

            this.routeChanged($scope, layersService);

            layersService.eventHelper.addListener(() => {
                this.routeChanged($scope, layersService);
            });

            $scope.toggleKmMarker = () => {
                if (this.drawingRoute != null) {
                    this.drawingRoute.toggleKmMarkers(!this.drawingRoute.isShowingKmMarkers());
                }
            }

            $scope.isShowingKmMarkers = (): boolean => {
                if (this.drawingRoute == null) {
                    return false;
                }
                return this.drawingRoute.isShowingKmMarkers();
            }
        }

        private routeChanged = ($scope: IRouteStatisticsScope, layersService: Services.LayersService) => {
            var selectedDrawing = layersService.getSelectedDrawing();
            if (selectedDrawing.name === Common.Constants.MARKERS) {
                return;
            }
            this.drawingRoute = selectedDrawing as Services.Drawing.DrawingRoute;
            this.updateChart($scope);

            this.drawingRoute.setRouteDataChangedCallback(() => {
                this.updateChart($scope);
            });
        }

        private updateChart = ($scope: IRouteStatisticsScope) => {
            var statistics = this.drawingRoute.getRouteStatistics();
            $scope.chart.data.rows.splice(0, $scope.chart.data.rows.length);
            for (let point of statistics.points) {
                $scope.chart.data.rows.push({
                    c: [{ v: point.x } as google.visualization.DataObjectCell,
                        { v: point.y } as google.visualization.DataObjectCell,
                        { v: point.latlng.lat } as google.visualization.DataObjectCell,
                        { v: point.latlng.lng } as google.visualization.DataObjectCell,
                        { v: point.y } as google.visualization.DataObjectCell,
                        { v: 0 } as google.visualization.DataObjectCell,
                        { v: `<div class="chart-tooltip">Distance:&nbsp;${point.x.toFixed(2)}&nbsp;Km<br/>Height:&nbsp;${point.y}&nbsp;m</div>` } as google.visualization.DataObjectCell]
                } as google.visualization.DataObjectRow);
            }
            $scope.chart.options.colors = [this.drawingRoute.getColor()];
            let min = _.minBy(statistics.points, (pointToMin) => pointToMin.y).y;
            let max = _.maxBy(statistics.points, (pointToMax) => pointToMax.y).y;
            $scope.chart.options.vAxis.viewWindow = {
                min: min > 0 ? min * 0.9 : min * 1.1,
                max: max > 0 ? max * 1.1 : max * 0.9
            } as google.visualization.ChartViewWindow;
            $scope.length = this.toDisplayableUnit(statistics.length);
            $scope.gain = this.toDisplayableUnit(statistics.gain);
            $scope.loss = this.toDisplayableUnit(statistics.loss);

            var icon = Services.IconsService.createHoverIcon(this.drawingRoute.getColor());
            this.hoverChartMarker.setIcon(icon);
        }

        private toDisplayableUnit = (distance: number): string => {
            return distance > 1000 ? (distance / 1000.0).toFixed(2) + "Km" : distance.toFixed(0) + "m";
        }
    }

}