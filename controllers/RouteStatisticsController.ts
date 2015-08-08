module IsraelHiking.Controllers {
    export interface IRouteStatisticsScope extends angular.IScope {
        length: string;
        chartData: { x: string; y: number }[];
        chartOptions: any;
    }

    export class RouteStatisticsController {
        drawingRoute: Services.Drawing.DrawingRoute;

        constructor($scope: IRouteStatisticsScope, layersService: Services.LayersService) {
            $scope.chartData = [];
            $scope.chartOptions = {};
            this.routeChanged($scope, layersService);

            layersService.eventHelper.addListener((args: Common.IDataChangedEventArgs) => {
                this.routeChanged($scope, layersService);
            });
        }

        private routeChanged = ($scope: IRouteStatisticsScope, layersService: Services.LayersService) => {
            var selectedDrawing = layersService.getSelectedDrawing();
            if (selectedDrawing.name == Common.Constants.MARKERS) {
                return;
            }
            this.drawingRoute = <Services.Drawing.DrawingRoute>selectedDrawing;
            this.updateChart($scope);

            this.drawingRoute.setRouteDataChangedCallback(() => {
                this.updateChart($scope);
            });
        }

        private updateChart = ($scope: IRouteStatisticsScope) => {
            var statistics = this.drawingRoute.getRouteStatistics();

            $scope.length = statistics.length.toFixed(2);
            $scope.chartData = statistics.points;
            $scope.chartOptions = {
                axes: {
                    x: { type: "linear", ticks: 4, ticksFormat: ".2f", key: "x" },
                    y: { type: "linear", ticks: 5 },
                },
                margin: {
                    left: 30,
                    right: 5,
                    top: 5,
                    bottom: 25
                },
                series: [{ y: "y", color: this.drawingRoute.getPathOptions().color, thickness: "2px", type: "area", striped: true, label: this.drawingRoute.name }],
                lineMode: "linear",
                tension: 0.7,
                tooltip: { mode: "scrubber", formatter: function (x, y, series) { return "(" + x + "," + y + ")"; } },
                drawLegend: false,
                drawDots: true,
                hideOverflow: false,
                columnsHGap: 5
            }
            if (!$scope.$$phase) {
                $scope.$apply();
            }
        }
    }

}