namespace IsraelHiking.Directives {

    export interface IDropdownItem {

    }

    interface IDropdownScopeDecleration {
        ngModel: string;
        ngList: string;
        ngLabel: string;
        placeholder: string;
        ngValue: string;
        ngId: string;
    }

    export interface IDropdownScope extends angular.IScope {
        ngModel: any;
        ngLabel: string;
        placeholder: string;
        ngValue: string;
        ngId: string;
        ngList: () => IDropdownItem[];
        getLabel(item: IDropdownItem): string;
        select(item: IDropdownItem): void;
        getSelectedLabel(): string;
        isOpen: boolean;
    }

    export class DropdownDirective implements angular.IDirective {
        constructor() {
            return {
                restrict: "EA",
                templateUrl: "directives/dropdown.html",
                require: "ngModel",
                scope: { ngModel: "=", ngList: "&", ngLabel: "@", placeholder: "@", ngValue: "@", ngId: "@" } as IDropdownScopeDecleration,
                link: ($scope: IDropdownScope) => {
                    $scope.isOpen = false;
                    let getValueDelegate = (item: IDropdownItem) => {
                        return $scope.ngValue ? item[$scope.ngValue] : item;
                    }

                    $scope.select = (item: IDropdownItem) => {
                        $scope.ngModel = getValueDelegate(item);
                        $scope.isOpen = false;
                    };
                    $scope.getLabel = (item: IDropdownItem) => {
                        if (!item) {
                            return "";
                        }
                        return $scope.ngLabel ? item[$scope.ngLabel] : item;
                    }

                    $scope.getSelectedLabel = () => {
                        let list = $scope.ngList();
                        let relevantItem = $scope.ngId
                            ? _.find(list, i => $scope.ngModel && i[$scope.ngId] === $scope.ngModel[$scope.ngId])
                            : _.find(list, i => getValueDelegate(i) == $scope.ngModel);
                        if (!relevantItem) {
                            return "";
                        }
                        return $scope.ngLabel ? relevantItem[$scope.ngLabel] : relevantItem;
                    }
                }
            } as angular.IDirective;
        }
    }
}