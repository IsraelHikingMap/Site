module IsraelHiking.Controllers {
    export interface IRouteStatisticsScope extends angular.IScope {
        length: string;
        gain: string;
        loss: string;
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
            var ticks = _.range(1, Math.floor(statistics.length / 1000.0) + 1, Math.ceil(statistics.length / 10000));
            var max = Math.ceil(statistics.length / 1000.0);
            $scope.length = this.toDisplayableUnit(statistics.length);
            $scope.gain = this.toDisplayableUnit(statistics.gain);
            $scope.loss = this.toDisplayableUnit(statistics.loss);
            $scope.chartData = statistics.points;
            $scope.chartOptions = {
                axes: {
                    x: { type: "linear", ticks: ticks, ticksFormat: "d", key: "x", max: max, innerTicks: true},
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

        private toDisplayableUnit = (distance: number): string => {
            return distance > 1000 ? (distance / 1000.0).toFixed(2) + "Km" : distance.toFixed(0) + "m";
        }
    }

}