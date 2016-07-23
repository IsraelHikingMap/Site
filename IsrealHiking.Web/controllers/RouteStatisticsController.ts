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

    export class RouteStatisticsController extends Services.ObjectWithMap {

        private routeLayer: Services.Layers.RouteLayers.RouteLayer;
        private hoverChartMarker: L.Marker;
        private kmMarkersGroup: L.LayerGroup<L.Marker>;
        private routeDataChangedEventHandler: (data: {}) => void;

        constructor($scope: IRouteStatisticsScope,
            layersService: Services.LayersService,
            mapService: Services.MapService) {
            super(mapService);

            this.routeLayer = null;
            this.kmMarkersGroup = L.layerGroup([]);
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

            layersService.eventHelper.addListener(() => {
                this.routeChanged($scope, layersService);
            });

            $scope.toggleKmMarker = () => {
                $scope.isKmMarkersOn = !$scope.isKmMarkersOn;
                this.updateKmMarkers($scope.isKmMarkersOn);
            }
        }

        private routeChanged = ($scope: IRouteStatisticsScope, layersService: Services.LayersService) => {
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

        private toDisplayableUnit = (distance: number): string => {
            return distance > 1000 ? (distance / 1000.0).toFixed(2) + "Km" : distance.toFixed(0) + "m";
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
            let start = routeData.segments[0].routePoint.latlng;
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
                        { v: `<div class="chart-tooltip">Distance:&nbsp;${point.x.toFixed(2)}&nbsp;Km<br/>Height:&nbsp;${point.y}&nbsp;m</div>` } as google.visualization.DataObjectCell]
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
            $scope.length = this.toDisplayableUnit(statistics.length);
            $scope.gain = this.toDisplayableUnit(statistics.gain);
            $scope.loss = this.toDisplayableUnit(statistics.loss);

            var icon = Services.IconsService.createHoverIcon(routeColor);
            this.hoverChartMarker.setIcon(icon);
    }

        private initializeChart = ($scope: IRouteStatisticsScope) => {
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
        }
    }
}