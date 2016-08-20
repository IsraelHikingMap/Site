namespace IsraelHiking {
    export var app = angular.module("Oruxmaps", []);

    app.controller("OruxmapsController", ["$scope", "$window", ($scope, $window: angular.IWindowService) => new OruxmapsController($scope, $window)]);

    export class OruxmapsController {
        constructor($scope, $window: angular.IWindowService) {
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

            if ($window.location.hash) {
                for (let link of $scope.links) {
                    if ($window.location.hash.toLowerCase().indexOf(link.hash.toLowerCase()) !== -1) {
                        $scope.redirect(link.url);
                    }
                }    
            }
        }
    }
}