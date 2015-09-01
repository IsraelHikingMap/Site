module IsraelHiking.Controllers {
    export interface IRouteStatisticsScope extends angular.IScope {
        length: string;
        gain: string;
        loss: string;
        isKmMarkersOn: boolean;
        isShowingKmMarkers(): boolean;
        toggleKmMarker(): void;
        chart: any;
    }

    export class RouteStatisticsController {
        drawingRoute: Services.Drawing.DrawingRoute;

        constructor($scope: IRouteStatisticsScope, layersService: Services.LayersService) {

            $scope.chart = <any> {};
            $scope.chart.type = "AreaChart";
            $scope.chart.data = <google.visualization.DataObject>{
                cols: <google.visualization.DataObjectColumn[]>[
                    <google.visualization.DataObjectColumn>{
                        id: "distance",
                        label: "Distance",
                        type: "number"
                    },
                    <google.visualization.DataObjectColumn>{
                        id: "height",
                        label: "Height",
                        type: "number"
                    },
                ],
                rows: <google.visualization.DataObjectRow[]>[]
            };

            $scope.chart.options = <google.visualization.AreaChartOptions> {
                isStacked: true,
                fill: 20,
                displayExactValues: true,
                legend: "none",
                chartArea: <google.visualization.ChartArea>{
                    left: 50,
                    top: 10,
                    width: "100%",
                    height: "75%"
                },
                backgroundColor: { fill: "transparent" },
                vAxis: <google.visualization.ChartAxis>{
                    title: "Height (m)",
                    viewWindowMode: "explicit",
                    gridlines: <google.visualization.ChartGridlines>{
                        color: "transparent"
                    }
                },
                hAxis: <google.visualization.ChartAxis>{
                    title: "Distance (Km)",
                    gridlines: <google.visualization.ChartGridlines>{
                        color: "transparent"
                    }
                },
            };

            $scope.chart.formatters = {};

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
            $scope.chart.data.rows.splice(0, $scope.chart.data.rows.length);
            for (var index = 0; index < statistics.points.length; index++) {
                var point = statistics.points[index];
                $scope.chart.data.rows.push(<google.visualization.DataObjectRow>
                    {
                    c: [<google.visualization.DataObjectCell>{ v: point.x },
                        <google.visualization.DataObjectCell>{ v: point.y }, ]
                    });
            }
            $scope.chart.options.colors = [this.drawingRoute.getColor()];
            $scope.chart.options.vAxis.viewWindow = <google.visualization.ChartViewWindow>{
                min: _.min(statistics.points, (point) => point.y).y,
                max: _.max(statistics.points, (point) => point.y).y,
            }
            $scope.length = this.toDisplayableUnit(statistics.length);
            $scope.gain = this.toDisplayableUnit(statistics.gain);
            $scope.loss = this.toDisplayableUnit(statistics.loss);
        }

        private toDisplayableUnit = (distance: number): string => {
            return distance > 1000 ? (distance / 1000.0).toFixed(2) + "Km" : distance.toFixed(0) + "m";
        }
    }

}