module IsraelHiking.Controllers {
    export interface IRouteStatisticsScope extends angular.IScope {
        length: number;
        chartData: { x: string; y: number }[];
        chartOptions: any;
    }

    export class RouteStatisticsController {
        constructor($scope: IRouteStatisticsScope, layersService: Services.LayersService) {
            $scope.length = 4;
            $scope.chartData = [{ x: "1", y: 1 }, { x: "2", y: 2 }, { x: "3", y: 1.5 }, { x: "4", y: 1.3 }];
            $scope.chartOptions = {
                axes: {
                    x: { key: 'x', ticksFormat: '.2f', type: 'linear', ticks: 4 },
                    y: { type: 'linear', ticks: 5 },
                },
                margin: {
                    left: 25,
                    right: 5,
                    top: 5,
                    bottom: 25
                },
                series: [{ y: 'y', color: 'steelblue', thickness: '2px', type: 'area', striped: true, label: 'Route' }, ],
                lineMode: 'linear',
                tension: 0.7,
                tooltip: { mode: 'scrubber', formatter: function (x, y, series) { return "(" + x + "," + y + ")"; } },
                drawLegend: false,
                drawDots: true,
                hideOverflow: false,
                columnsHGap: 5
            }
        }
    }

}