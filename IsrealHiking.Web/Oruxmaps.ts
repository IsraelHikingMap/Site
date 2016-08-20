namespace IsraelHiking {
    export var app = angular.module("Oruxmaps", []);

    app.controller("OruxmapsController", ["$scope", "$window", "$timeout",
        ($scope, $window: angular.IWindowService, $timeout: angular.ITimeoutService) =>
            new OruxmapsController($scope, $window, $timeout)]);

    export class OruxmapsController {
        constructor($scope,
            $window: angular.IWindowService,
            $timeout: angular.ITimeoutService) {
            $scope.links = [
                {
                    url: "orux-map://israelhiking.osm.org.il/Oruxmaps/IsraelHiking.zip",
                    description: "Israel Hiking Map zoom 15",
                    descriptionHebrew: "מפת הטיולים החופשית זום 15",
                    hash: "IHM15"
                },
                {
                    url: "orux-map://israelhiking.osm.org.il/Oruxmaps/IsraelMTB.zip",
                    description: "Israel MTB Map zoom 15",
                    descriptionHebrew: "מפת האופניים החופשית זום 15",
                    hash: "IMTBM15"
                }
            ];
            $scope.redirect = (address: string) => {
                $window.location.href = address;
            }

            if ($window.location.hash && navigator.userAgent.match(/Android/i)) {
                for (let link of $scope.links) {
                    if ($window.location.hash.toLowerCase().indexOf(link.hash.toLowerCase()) !== -1) {
                        $timeout(() => {
                            $window.location.href = link.url;
                        }, 500);
                        return;
                    }
                }    
            }
        }
    }
}