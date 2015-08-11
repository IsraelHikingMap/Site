module IsraelHiking.Controllers {
    export interface IRouteStatisticsScope extends angular.IScope {
        length: string;
        isKmMarkersOn: boolean;
        chartData: { x: string; y: number }[];
        chartOptions: any;
        isShowingKmMarkers(): boolean;
        toggleKmMarker(): void;
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
            var ticks = _.range(1, Math.floor(statistics.length) + 1, Math.ceil(statistics.length / 10));
            $scope.length = statistics.length.toFixed(2);
            $scope.chartData = statistics.points;
            $scope.chartOptions = {
                axes: {
                    x: { type: "linear", ticks: ticks, ticksFormat: "d", key: "x" },
                    y: { type: "linear", ticks: 5 },
                },
                margin: {
                    left: 30,
                    right: 5,
                    top: 5,
                    bottom: 25
                },
                series: [{ y: "y", color: this.drawingRoute.getColor(), thickness: "2px", type: "area", striped: true, label: this.drawingRoute.name }],
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