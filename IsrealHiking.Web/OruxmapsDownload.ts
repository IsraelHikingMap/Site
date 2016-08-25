namespace IsraelHiking.Oruxmaps {

    export interface ILink {
        url: string;
        description: string;
        descriptionHebrew: string;
        hash: string;
    }

    export interface IOruxmpasScope extends angular.IScope {
        links: ILink[];
        isHebrew: boolean;
        redirect(address: string): void;
    }

    export var app = angular.module("Oruxmaps", []);

    app.config($compileProvider => {
        $compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|orux-map):/);
    });

    app.controller("OruxmapsController", ["$scope", "$window", "$timeout",
        ($scope, $window: angular.IWindowService, $timeout: angular.ITimeoutService) =>
            new OruxmapsController($scope, $window, $timeout)]);

    export class OruxmapsController {
        constructor($scope: IOruxmpasScope,
            $window: angular.IWindowService,
            $timeout: angular.ITimeoutService) {

            $scope.isHebrew = true;
            $scope.links = [
                {
                    url: "//israelhiking.osm.org.il/Oruxmaps/IsraelHiking.zip",
                    description: "Israel Hiking Map up to zoom 15 [750MB]",
                    descriptionHebrew: "מפת הטיולים הפתוחה עד זום 15 [750MB]",
                    hash: "IHM15"
                },
                {
                    url: "//israelhiking.osm.org.il/Oruxmaps/IsraelMTB.zip",
                    description: "Israel MTB Map up to zoom 15 [720MB]",
                    descriptionHebrew: "מפת האופניים הפתוחה עד זום 15 [720MB]",
                    hash: "IMTBM15"
                },
                {
                    url: "//israelhiking.osm.org.il/Oruxmaps/IsraelHiking16.zip",
                    description: "Israel Hiking Map up to zoom 16 [2.5GB]",
                    descriptionHebrew: "מפת הטיולים הפתוחה עד זום 16 [2.5GB]",
                    hash: "IHM16"
                },
                {
                    url: "//israelhiking.osm.org.il/Oruxmaps/IsraelMTB16.zip",
                    description: "Israel MTB Map up to zoom 16 [2.2GB]",
                    descriptionHebrew: "מפת האופניים הפתוחה עד זום 16 [2.2GB]",
                    hash: "IMTBM16"
                }
            ];

            $scope.redirect = (address: string) => {
                if (navigator.userAgent.match(/Android/i)) {
                    return `orux-map:${address}`;
                } else {
                    return address;
                }
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
