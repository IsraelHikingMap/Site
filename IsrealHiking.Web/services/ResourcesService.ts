// link to translations: https://translate.zanata.org/iteration/view/IsraelHiking/Main
namespace IsraelHiking.Services {

    export interface ILocale {
        languageCode: string;
        rtl: boolean;
    }

    export class ResourcesService {
        private gettextCatalog: angular.gettext.gettextCatalog;
        public direction: string;

        // all the text in the app //
        /////////////////////////////
        public about: string;
        public help: string;
        public legend: string;
        public clear: string;
        public editPoi: string;
        public editRoute: string;
        public hikeRouteing: string;
        public bikeRouting: string;
        public fourWheelDriveRouting: string;
        public straightLines: string;
        public routeStatistics: string;
        public undo: string;
        public editThisMapUsingOsm: string;
        public openAFile: string;
        public saveCurrentWork: string;
        public saveAs: string;
        public save: string;
        public print: string;
        public deleteLayer: string;
        public layers: string;
        public toggleAdvanceSettings: string;
        public baseLayerOptions: string;
        public addBaseLayer: string;
        public overlayProperties: string;
        public addOverlay: string;
        public routeProperties: string;
        public addRoute: string;
        public saveRouteToFile: string;
        public reverseRoute: string;
        public toggleVisibility: string;
        public toggleRoutingPerPoint: string;
        public deleteRoute: string;
        public search: string;
        public share: string;
        public generateUrlToShareWithYourFriends: string;
        public zoomIn: string;
        public zoomOut: string;
        public showMeWhereIAm: string;
        public excitedGo: string;

        constructor(gettextCatalog: angular.gettext.gettextCatalog) {
            this.gettextCatalog = gettextCatalog;
            this.setRtl(false);
        }

        private setRtl = (rtl: boolean) => {
            if (rtl) {
                this.direction = "rtl";
            } else {
                this.direction = "ltr";
            }
        }

        public changeLanguage = (locale: ILocale): angular.IPromise<any> => {
            this.setRtl(locale.rtl);
            this.gettextCatalog.setCurrentLanguage(locale.languageCode);

            return this.gettextCatalog.loadRemote(Common.Urls.translations + locale.languageCode + ".json")
                .then(() => {
                    this.about = this.gettextCatalog.getString("About");
                    this.help = this.gettextCatalog.getString("Help");
                    this.legend = this.gettextCatalog.getString("Legend");
                    this.clear = this.gettextCatalog.getString("Clear");
                    this.editPoi = this.gettextCatalog.getString("Edit POI");
                    this.editRoute = this.gettextCatalog.getString("Edit Route");
                    this.hikeRouteing = this.gettextCatalog.getString("Hike Routing");
                    this.bikeRouting = this.gettextCatalog.getString("Bike Routing");
                    this.fourWheelDriveRouting = this.gettextCatalog.getString("4x4 Routing");
                    this.straightLines = this.gettextCatalog.getString("Straight Lines");
                    this.routeStatistics = this.gettextCatalog.getString("Route Statistics");
                    this.undo = this.gettextCatalog.getString("Undo");
                    this.editThisMapUsingOsm = this.gettextCatalog.getString("Edit This Map Using OSM");
                    this.openAFile = this.gettextCatalog.getString("Open a File");
                    this.saveCurrentWork = this.gettextCatalog.getString("Save Current Work");
                    this.saveAs = this.gettextCatalog.getString("Save As...");
                    this.save = this.gettextCatalog.getString("Save");
                    this.print = this.gettextCatalog.getString("Print");
                    this.deleteLayer = this.gettextCatalog.getString("Delete Layer");
                    this.layers = this.gettextCatalog.getString("Layers");
                    this.toggleAdvanceSettings = this.gettextCatalog.getString("Toggle Advance Settings");
                    this.baseLayerOptions = this.gettextCatalog.getString("Base Layer Options");
                    this.addBaseLayer = this.gettextCatalog.getString("Add Base Layer");
                    this.overlayProperties = this.gettextCatalog.getString("Overlay Properties");
                    this.addOverlay = this.gettextCatalog.getString("Add Overlay");
                    this.routeProperties = this.gettextCatalog.getString("Route Properties");
                    this.addRoute = this.gettextCatalog.getString("Add Overlay");
                    this.saveRouteToFile = this.gettextCatalog.getString("Save Route to File");
                    this.reverseRoute = this.gettextCatalog.getString("Reverse Route");
                    this.toggleVisibility = this.gettextCatalog.getString("Toggle Visibility");
                    this.toggleRoutingPerPoint = this.gettextCatalog.getString("Toggle Routing Type Per Point");
                    this.deleteRoute = this.gettextCatalog.getString("Delete Route");
                    this.search = this.gettextCatalog.getString("Search");
                    this.share = this.gettextCatalog.getString("Share");
                    this.generateUrlToShareWithYourFriends = this.gettextCatalog.getString("Generate A URL To Share With Your Friends!");
                    this.zoomIn = this.gettextCatalog.getString("Zoom In");
                    this.zoomOut = this.gettextCatalog.getString("Zoom Out");
                    this.showMeWhereIAm = this.gettextCatalog.getString("Show Me Where I am");
                    this.excitedGo = this.gettextCatalog.getString("GO!");
                });
        }
    }
}