declare namespace L {
    export namespace control {
        export function locate(options: any): L.Control;
    }
}

namespace IsraelHiking.Controllers {
    export interface IMainMapScope extends IRootScope {
        sidebarService: Services.SidebarService;
        getIsSidebarVisible(): boolean;
        closeSidebar(): void;
        isRouteStatisticsVisible(): boolean;
    }

    export class MainMapcontoller extends BaseMapController {
        $compile: angular.ICompileService;
        $location: angular.ILocationService;
        $window: angular.IWindowService;
        $timeout: angular.ITimeoutService;
        toastr: Toastr;

        constructor($scope: IMainMapScope,
            $location: angular.ILocationService,
            $window: angular.IWindowService,
            $compile: angular.ICompileService,
            $timeout: angular.ITimeoutService,
            mapService: Services.MapService,
            hashService: Services.HashService,
            sidebarService: Services.SidebarService,
            routeStatisticsService: Services.RouteStatisticsService,
            toastr: Toastr) {
            super(mapService);

            this.$compile = $compile;
            this.$location = $location;
            this.$window = $window;
            this.$timeout = $timeout;
            this.toastr = toastr;

            this.createControls($scope);

            $scope.sidebarService = sidebarService;

            $scope.getIsSidebarVisible = () => {
                return sidebarService.isVisible;
            }

            $scope.closeSidebar = () => {
                sidebarService.hide();
            }

            $scope.isRouteStatisticsVisible = (): boolean => {
                return routeStatisticsService.isVisible;
            }
        }

        private createControls = ($scope: IRootScope) => {
            this.createContorl($scope, "zoom-control", "topleft", true);

            L.control.locate({
                compile: this.$compile,
                scope: $scope.$new(),
                icon: "fa fa-crosshairs",
                keepCurrentZoomLevel: true,
                follow: true,
                onLocationError: () => {
                    if (this.$location.protocol() === "https") {
                        this.toastr.warning($scope.resources.unableToFindYourLocation);
                    } else {
                        this.toastr.warning($scope.resources.unableToFindYourLocation + "\n" + $scope.resources.redirectingToSecuredSite);
                        this.$timeout(() => {
                            this.$window.location.href = this.$location.absUrl().replace("http", "https");
                        }, 3000);
                    }
                }
            }).addTo(this.map);

            this.createContorl($scope, "layers-control");
            this.createContorl($scope, "file-control");
            this.createContorl($scope, "save-as-control");
            this.createContorl($scope, "edit-osm-control", "topleft", true);
            this.createContorl($scope, "info-control");
            this.createContorl($scope, "osm-user-control", "topright");
            this.createContorl($scope, "search-control", "topright");
            this.createContorl($scope, "drawing-control", "topright");
            this.createContorl($scope, "share-control", "topright");
            this.createContorl($scope, "language-control", "topright");

            L.control.scale({ imperial: false } as L.ScaleOptions).addTo(this.map);
        }

        /**
         * Creates a control on the leaflet map
         * 
         * @param directiveHtmlName - the dricetive html string
         * @param position - the position to place the control: topleft/topright/bottomleft/bottomright
         */
        private createContorl($scope: angular.IRootScopeService, directiveHtmlName: string, position: L.PositionString = "topleft", hiddenOnMoblie = false) {
            var control = L.Control.extend({
                options: {
                    position: position
                } as L.ControlOptions,
                onAdd: (): HTMLElement => {
                    let classString = directiveHtmlName + "-container";
                    if (hiddenOnMoblie)
                    {
                        classString += " hidden-xs";
                    }
                    let controlDiv = angular.element("<div>")
                        .addClass(classString)
                        .append(this.$compile(`<${directiveHtmlName}></${directiveHtmlName}>`)($scope.$new()));
                    return controlDiv[0];
                },
                onRemove: () => { }
            } as L.ClassExtendOptions);
            new control().addTo(this.map);
        }
    }
} 
