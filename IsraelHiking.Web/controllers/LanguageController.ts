﻿namespace IsraelHiking.Controllers {

    export interface ILanguageScope extends IRootScope {
        selectedLanguage: Services.ILanguage;
        setSelectredLanguage(language: Services.ILanguage): void;
        setLanguage(language: Services.ILanguage): void;
        openModal(e: Event): void;
    }

    export class LanguageController extends BaseMapController {
        constructor($scope: ILanguageScope,
            $uibModal: angular.ui.bootstrap.IModalService,
            mapService: Services.MapService) {
            super(mapService);

            $scope.selectedLanguage = $scope.resources.currentLanguage;

            $scope.setLanguage = (language: Services.ILanguage) => {
                $scope.resources.setLanguage(language);
            }

            $scope.setSelectredLanguage = (language: Services.ILanguage) => {
                $scope.selectedLanguage = language;
            }

            $scope.openModal = (e: Event) => {
                $uibModal.open({
                    scope: $scope,
                    templateUrl: "controllers/languageModal.html"
                });
                this.suppressEvents(e);
            }
        }
    }
}