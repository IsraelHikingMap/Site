module IsraelHiking.Controllers {

    export interface IFileScope extends angular.IScope {
        open($files, e: Event): void;
        openFileChooser(e: Event): void;
        save(e: Event, fileName: string): void;
    }

    export class FileController extends BaseMapControllerWithToolTip {
        private static MAX_SEGMENTS_NUMBER = 20;
        private static MININAM_SEGMENT_LENGTH = 500; // meter

        private layersService: Services.LayersService;
        private drawingMarkerService: Services.DrawingMarkerService;
        private parserFactory: Services.Parsers.ParserFactory;
        private fileChooserTooltip: any;

        constructor($scope: IFileScope,
            mapService: Services.MapService,
            $tooltip,
            layersService: Services.LayersService,
            drawingMarkerService: Services.DrawingMarkerService,
            parserFactory: Services.Parsers.ParserFactory) {
            super(mapService, $tooltip);

            this.layersService = layersService;
            this.drawingMarkerService = drawingMarkerService;
            this.parserFactory = parserFactory;
            this.setDragAndDrop($scope);

            $scope.open = ($files, e: Event) => {

                if ($files.length <= 0) {
                    return;
                }
                var file = $files.shift();
                var ext = file.name.split('.').pop();
                var parser = this.parserFactory.Create(ext);
                if (parser == null) {
                    return;
                }
                var reader = new FileReader();
                reader.onload = (e: any) => {
                    var data = parser.parse(e.target.result);
                    this.map.fitBounds(data.bounds);
                    this.manipulateRoutesData(data.routesData);
                    this.drawingMarkerService.setData(data.markers);
                    $scope.$apply();
                };
                reader.readAsText(file);
            }

            $scope.openFileChooser = (e: Event) => {
                if (this.fileChooserTooltip == null) {
                    this.fileChooserTooltip = this.createToolTip(e.target, "views/templates/fileTooltip.tpl.html", "Save", $scope);
                    this.fileChooserTooltip.$promise.then(this.fileChooserTooltip.show);
                }
                this.suppressEvents(e);
            }

            $scope.save = (e: Event, fileName: string) => {
                var data = <Common.DataContainer> {
                    markers: this.drawingMarkerService.getData(),
                    routesData: this.layersService.getData(),
                };
                var ext = fileName.split('.').pop();
                var parser = this.parserFactory.Create(ext);
                var dtatString = parser.toString(data);
                var blob = new Blob([dtatString], { type: "application/json" })
                var blobURL = ((<any>window).URL || (<any>window).webkitURL).createObjectURL(blob);
                var anchor = <any>document.createElement("a");
                anchor.style = "display: none";
                anchor.download = fileName;
                anchor.href = blobURL;
                document.body.appendChild(anchor);
                anchor.click();

                setTimeout(function () {
                    document.body.removeChild(anchor);
                    ((<any>window).URL || (<any>window).webkitURL).revokeObjectURL(blobURL);
                }, 100);
            }
        }

        private setDragAndDrop = ($scope: IFileScope) => {
            var dropbox = this.map.getContainer();

            var callbacks = {
                dragenter: () => {
                    this.map.scrollWheelZoom.disable();
                },
                dragleave: () => {
                    this.map.scrollWheelZoom.enable();
                },
                dragover: (e: DragEvent) => {
                    e.stopPropagation();
                    e.preventDefault();
                },
                drop: (e: DragEvent) => {
                    e.stopPropagation();
                    e.preventDefault();
                    var files = Array.prototype.slice.apply(e.dataTransfer.files);
                    setTimeout(() => {
                        $scope.open(files, null);
                    }, 25);
                    this.map.scrollWheelZoom.enable();
                }
            };
            for (var name in callbacks) {
                dropbox.addEventListener(name, callbacks[name], false);
            }
        }

        private manipulateRoutesData(routesData: Common.RouteData[]) {

            for (var routeIndex = 0; routeIndex < routesData.length; routeIndex++) {
                var routeData = routesData[routeIndex];
                var selectedRoute = this.layersService.getSelectedRoute();
                var manipulatedRouteData = <Common.RouteData> {
                    segments: [],
                    routingType: (selectedRoute == null) ? Common.routingType.none : selectedRoute.getRoutingType(),
                };
                for (var segmentIndex = 0; segmentIndex < routeData.segments.length; segmentIndex++) {
                    var segment = routeData.segments[segmentIndex].latlngs;
                    var routeLength = 0;
                    for (var latlngIndex = 1; latlngIndex < segment.length; latlngIndex++) {
                        routeLength += segment[latlngIndex - 1].distanceTo(segment[latlngIndex]);
                    }
                    var segmentLength = routeLength / FileController.MAX_SEGMENTS_NUMBER;
                    if (segmentLength < FileController.MININAM_SEGMENT_LENGTH) {
                        segmentLength = FileController.MININAM_SEGMENT_LENGTH;
                    }
                    var currentSegmentLength = 0;
                    var segmentData = <Common.RouteSegmentData> { latlngs: [segment[0]] };
                    for (var latlngIndex = 1; latlngIndex < segment.length; latlngIndex++) {
                        currentSegmentLength += segment[latlngIndex - 1].distanceTo(segment[latlngIndex]);
                        if (currentSegmentLength < segmentLength) {
                            segmentData.latlngs.push(segment[latlngIndex]);
                            continue;
                        }
                        segmentData.routePoint = segmentData.latlngs[segmentData.latlngs.length - 1];
                        manipulatedRouteData.segments.push(segmentData);
                        segmentData = <Common.RouteSegmentData> { latlngs: [segment[latlngIndex - 1], segment[latlngIndex]] };
                        currentSegmentLength = 0;
                    }
                }

                this.layersService.addRoute(routeData.name, manipulatedRouteData);
            }
        }
    }
} 