// link to translations: https://translate.zanata.org/iteration/view/IsraelHiking/Main
namespace IsraelHiking.Services {

    export interface ILanguage {
        code: string;
        rtl: boolean;
        label: string;
    }

    const languageKey = "language";

    export class ResourcesService {
        private $sce: angular.ISCEService;
        private gettextCatalog: angular.gettext.gettextCatalog;
        private localStorageService: angular.local.storage.ILocalStorageService;
        public currentLanguage: ILanguage;

        public direction: string;
        public start: string;
        public end: string;
        // All the text in the app //
        /////////////////////////////
        public about: string;
        public help: string;
        public legend: string;
        public clear: string;
        public editPoi: string;
        public editRoute: string;
        public hikeRouting: string;
        public bikeRouting: string;
        public fourWheelDriveRouting: string;
        public straightLines: string;
        public routeStatistics: string;
        public undo: string;
        public editThisMapUsingOsm: string;
        public openAFile: string;
        public saveAs: string;
        public save: string;
        public print: string;
        public deleteLayer: string;
        public layers: string;
        public toggleAdvancedSettings: string;
        public baseLayerProperties: string;
        public addBaseLayer: string;
        public overlayProperties: string;
        public addOverlay: string;
        public routeProperties: string;
        public addRoute: string;
        public saveRouteToFile: string;
        public reverseRoute: string;
        public toggleVisibility: string;
        public toggleRoutingPerSegment: string;
        public deleteRoute: string;
        public search: string;
        public share: string;
        public generateUrlToShareWithYourFriends: string;
        public zoomIn: string;
        public zoomOut: string;
        public showMeWhereIAm: string;
        public excitedGo: string;
        public name: string;
        public address: string;
        public minZoom: string;
        public maxZoom: string;
        public widthInPixels: string;
        public color: string;
        public opacity: string;
        public deletePoi: string;
        public showCoordinates: string;
        public coordinatesForWikipedia: string;
        public wikipedia: string;
        public length: string;
        public gain: string;
        public loss: string;
        public kmPoi: string;
        public meterUnit: string;
        public kmUnit: string;
        public distance: string;
        public height: string;
        public width: string;
        public heightInMeters: string;
        public distanceInKm: string;
        public searchPlaceHolder: string;
        public embedSize: string;
        public small: string;
        public medium: string;
        public large: string;
        public custom: string;
        public copyPasteEmbdExplenation: string;
        public html: string;
        public close: string;
        public northAbbreviation: string;
        public eastAbbreviation: string;
        public latitudeAbbreviation: string;
        public longitudeAbbreviation: string;
        public layerNamePlaceHolder: string;
        public shareYourWork: string;
        public language: string;
        public elevation: string;
        public slope: string;
        public convertToRoute: string;
        public removeSearchResults: string;
        // Help
        public helpSubheader: string;
        public helpInfo: string;
        public helpLocation: string;
        public helpOpen: string;
        public helpSave: string;
        public helpPrint: string;
        public helpPencil: string;
        public helpClear: string;
        public helpMapMarker: string;
        public helpUndo: string;
        public helpShare: string;
        public helpEditOsm: string;
        public helpLayersSubHeader: string;
        public helpGear: string;
        public helpEyeSlash: string;
        public helpWrench: string;
        public helpRoutePerSegment: string;
        public helpTrash: string;
        public helpReverse: string;
        public helpCheck: string;
        public helpLinksExplenation: string;
        public helpLanguage: string;
        public helpDragDrop: string;
        public helpYoutubeLink: string;
        // Info
        public infoSubheader: string;
        public infoHelpfulLinks: string;
        public infoFacebookLink: string;
        public infoGithubLink: string;
        public infoOsmWikiLink: string;
        public infoOruxmapDownloadLink: string;
        public infoFooterThanks: string;
        public infoFooterHarelAndZeev: string;
        // Legend
        public legendMarkedTrails: string;
        public legendRedMarkedTrail: string;
        public legendBlueMarkedTrail: string;
        public legendGreenMarkedTrail: string;
        public legendBlackMarkedTrail: string;
        public legendIsraelTrail: string;
        public legendRegionalTrail: string;
        public legendTrails: string;
        public legendAllVehicles: string;
        public legendLight4WDVehicles: string;
        public legendStrong4WDVehicles: string;
        public legendDifficult4WD: string;
        public legendPath: string;
        public legendFootPath: string;
        public legendBicyclePath: string;
        public legendSteps: string;
        public legendWater: string;
        public legendStream: string;
        public legendWadi: string;
        public legendRiver: string;
        public legendLakeReservoir: string;
        public legendSeasonalLake: string;
        public legendSpringPond: string;
        public legendWaterHole: string;
        public legendWaterWell: string;
        public legendCistern: string;
        public legendWaterfall: string;
        public legendWaterTower: string;
        public legendRoads: string;
        public legendMotorway: string;
        public legendTrunk: string;
        public legendPrimary: string;
        public legendSecondary: string;
        public legendTertiary: string;
        public legendUnclassified: string;
        public legendRailway: string;
        public legendRunwayTaxiway: string;
        public legendPoi: string;
        public legendPicnicArea: string;
        public legendCampsite: string;
        public legendViewpoint: string;
        public legendPeak: string;
        public legendRuins: string;
        public legendArcheologicalSite: string;
        public legendCave: string;
        public legendRegionalTrails: string;
        public legendJerusalemTrail: string;
        public legendSeatoSeaTrail: string;
        public legendGolanTrail: string;
        public legendKinneretTrail: string;
        public legendHaifaWadisTrail: string;
        public legendKinneretBicycleTrail: string;
        public legendPurpleRegionalTrail: string;
        public legendOrangeRegionalTrail: string;
        public legendSingles: string;
        public legendUnknownScale: string;
        public legendEasyWithDirection: string;
        public legendModerate: string;
        public legendAdvanced: string;
        public legendChallangingWithDirection: string;
        public legendBicycleTrails: string;
        public legendLocalTrail: string;
        public legendNationalTrail: string;



        constructor($sce: angular.ISCEService,
            localStorageService: angular.local.storage.ILocalStorageService,
            gettextCatalog: angular.gettext.gettextCatalog) {
            this.$sce = $sce;
            this.gettextCatalog = gettextCatalog;
            this.localStorageService = localStorageService;
            this.currentLanguage = localStorageService.get(languageKey) as ILanguage || { code: "en-US", rtl: false, label: "English"};
            this.setLanguage(this.currentLanguage);
        }

        private setRtl = (rtl: boolean) => {
            if (rtl) {
                this.direction = "rtl";
                this.start = "right";
                this.end = "left";
            } else {
                this.direction = "ltr";
                this.start = "left";
                this.end = "right";
            }
        }

        public setLanguage = (language: ILanguage): angular.IPromise<any> => {
            this.setRtl(language.rtl);
            this.gettextCatalog.setCurrentLanguage(language.code);
            this.localStorageService.set(languageKey, language);
            return this.gettextCatalog.loadRemote(Common.Urls.translations + language.code + ".json")
                .then(() => {
                    this.about = this.gettextCatalog.getString("About");
                    this.help = this.gettextCatalog.getString("Help");
                    this.legend = this.gettextCatalog.getString("Legend");
                    this.clear = this.gettextCatalog.getString("Clear");
                    this.editPoi = this.gettextCatalog.getString("Edit POI");
                    this.editRoute = this.gettextCatalog.getString("Edit Route");
                    this.hikeRouting = this.gettextCatalog.getString("Hike Routing");
                    this.bikeRouting = this.gettextCatalog.getString("Bike Routing");
                    this.fourWheelDriveRouting = this.gettextCatalog.getString("4x4 Routing");
                    this.straightLines = this.gettextCatalog.getString("Straight Lines");
                    this.routeStatistics = this.gettextCatalog.getString("Route Statistics");
                    this.undo = this.gettextCatalog.getString("Undo");
                    this.editThisMapUsingOsm = this.gettextCatalog.getString("Edit This Map Using OSM");
                    this.openAFile = this.gettextCatalog.getString("Open a File");
                    this.saveAs = this.gettextCatalog.getString("Save As...");
                    this.save = this.gettextCatalog.getString("Save");
                    this.print = this.gettextCatalog.getString("Print");
                    this.deleteLayer = this.gettextCatalog.getString("Delete Layer");
                    this.layers = this.gettextCatalog.getString("Layers");
                    this.toggleAdvancedSettings = this.gettextCatalog.getString("Toggle Advanced Settings");
                    this.baseLayerProperties = this.gettextCatalog.getString("Base Layer Properties");
                    this.addBaseLayer = this.gettextCatalog.getString("Add Base Layer");
                    this.overlayProperties = this.gettextCatalog.getString("Overlay Properties");
                    this.addOverlay = this.gettextCatalog.getString("Add Overlay");
                    this.routeProperties = this.gettextCatalog.getString("Route Properties");
                    this.addRoute = this.gettextCatalog.getString("Add Route");
                    this.saveRouteToFile = this.gettextCatalog.getString("Save Route to File");
                    this.reverseRoute = this.gettextCatalog.getString("Reverse Route");
                    this.toggleVisibility = this.gettextCatalog.getString("Toggle Visibility");
                    this.toggleRoutingPerSegment = this.gettextCatalog.getString("Toggle Routing Type Per Segment");
                    this.deleteRoute = this.gettextCatalog.getString("Delete Route");
                    this.search = this.gettextCatalog.getString("Search");
                    this.share = this.gettextCatalog.getString("Share");
                    this.generateUrlToShareWithYourFriends = this.gettextCatalog.getString("Generate A URL To Share With Your Friends!");
                    this.zoomIn = this.gettextCatalog.getString("Zoom In");
                    this.zoomOut = this.gettextCatalog.getString("Zoom Out");
                    this.showMeWhereIAm = this.gettextCatalog.getString("Show Me Where I am");
                    this.excitedGo = this.gettextCatalog.getString("GO!");
                    this.name = this.gettextCatalog.getString("Name");
                    this.address = this.gettextCatalog.getString("Address");
                    this.minZoom = this.gettextCatalog.getString("Min Zoom");
                    this.maxZoom = this.gettextCatalog.getString("Max Zoom");
                    this.widthInPixels = this.gettextCatalog.getString("Width (px)");
                    this.opacity = this.gettextCatalog.getString("Opacity");
                    this.color = this.gettextCatalog.getString("Color");
                    this.deletePoi = this.gettextCatalog.getString("Delete POI");
                    this.showCoordinates = this.gettextCatalog.getString("Show Coordinates");
                    this.coordinatesForWikipedia = this.$sce.trustAsHtml(this.gettextCatalog.getString("Coordinates for {{link}}Wikipedia{{linkend}}", { link: "<a href='https://he.wikipedia.org/' target='_blank'>", linkend: "</a>" }));
                    this.wikipedia = this.gettextCatalog.getString("Wikipedia");
                    this.length = this.gettextCatalog.getString("Length");
                    this.gain = this.gettextCatalog.getString("Gain");
                    this.loss = this.gettextCatalog.getString("Loss");
                    this.kmPoi = this.gettextCatalog.getString("Km POIs");
                    this.meterUnit = this.gettextCatalog.getString("m");
                    this.kmUnit = this.gettextCatalog.getString("Km");
                    this.distance = this.gettextCatalog.getString("Distance");
                    this.height = this.gettextCatalog.getString("Height");
                    this.width = this.gettextCatalog.getString("Width");
                    this.heightInMeters = this.gettextCatalog.getString("Height (m)");
                    this.distanceInKm = this.gettextCatalog.getString("Distance (Km)");
                    this.searchPlaceHolder = this.gettextCatalog.getString("Type to search..."); 
                    this.embedSize = this.gettextCatalog.getString("Embed Size");
                    this.small = this.gettextCatalog.getString("Small");
                    this.medium = this.gettextCatalog.getString("Medium");
                    this.large = this.gettextCatalog.getString("Large");
                    this.custom = this.gettextCatalog.getString("Custom");
                    this.copyPasteEmbdExplenation = this.gettextCatalog.getString("Copy and paste the code below in order to show this map on your webpage.");
                    this.html = this.gettextCatalog.getString("HTML"); 
                    this.close = this.gettextCatalog.getString("Close");
                    this.northAbbreviation = this.gettextCatalog.getString("N");
                    this.eastAbbreviation = this.gettextCatalog.getString("E");
                    this.latitudeAbbreviation = this.gettextCatalog.getString("Lat");
                    this.longitudeAbbreviation = this.gettextCatalog.getString("Lon");
                    this.layerNamePlaceHolder = this.gettextCatalog.getString("A name to be displayed in the layers control");
                    this.shareYourWork = this.gettextCatalog.getString("Share Your Work");
                    this.language = this.gettextCatalog.getString("Language");
                    this.elevation = this.gettextCatalog.getString("Elevation");
                    this.slope = this.gettextCatalog.getString("Slope");
                    this.convertToRoute = this.gettextCatalog.getString("Convert to Route");
                    this.removeSearchResults = this.gettextCatalog.getString("Remove Search Results");
                    // Help
                    this.helpSubheader = this.gettextCatalog.getString("Basic instructions on using this site");
                    this.helpInfo = this.gettextCatalog.getString("This dialog");
                    this.helpLocation = this.gettextCatalog.getString("Move the map to your current location");
                    this.helpOpen = this.gettextCatalog.getString("Open a file");
                    this.helpSave = this.gettextCatalog.getString("Save your work to a file");
                    this.helpPrint = this.gettextCatalog.getString("Print the map");
                    this.helpPencil = this.gettextCatalog.getString("Toggle drawing. Use escape to stop and click to edit a point"); 
                    this.helpClear = this.gettextCatalog.getString("Clear all points"); 
                    this.helpMapMarker = this.gettextCatalog.getString("Toggle POI drawing");
                    this.helpUndo = this.gettextCatalog.getString("Undo last action");
                    this.helpShare = this.gettextCatalog.getString("Share your work");
                    this.helpEditOsm = this.gettextCatalog.getString("Edit the map in OSM");
                    this.helpLayersSubHeader = this.gettextCatalog.getString("Layers controller (left side)");
                    this.helpGear = this.gettextCatalog.getString("Toggle advanced layers usage");
                    this.helpEyeSlash = this.gettextCatalog.getString("Hide layer");
                    this.helpWrench = this.gettextCatalog.getString("Open layer properties");
                    this.helpRoutePerSegment = this.gettextCatalog.getString("Change routing from single segment to all segments");
                    this.helpTrash = this.gettextCatalog.getString("Delete a layer");
                    this.helpReverse = this.gettextCatalog.getString("Reverse route's direction");
                    this.helpCheck = this.gettextCatalog.getString("Save layer properties");
                    this.helpLinksExplenation = this.gettextCatalog.getString("You can use the following links");
                    this.helpLanguage = this.gettextCatalog.getString("Change language");
                    this.helpDragDrop = this.gettextCatalog.getString("You can drag-and-drop files or URLs onto the map to load them.");
                    this.helpYoutubeLink = this.$sce.trustAsHtml(this.gettextCatalog.getString("Learn how to add and edit OpenStreetMap maps with our {{link}}YouTube tutorials{{linkend}}.", { link: "<a href='https://www.youtube.com/playlist?list=PL8pYDecWd7EjQIyJpPAwSH3UbeZzzQpNo' target='_blank'>", linkend: "</a>" }));
                    // Info
                    this.infoSubheader = this.$sce.trustAsHtml(this.gettextCatalog.getString("This map was generated from {{link}}Open Street Map (OSM){{linkend}} data which is free for all to use and edit.", { link: "<a dir='ltr' href='http://www.openstreetmap.org/' target='_blank'>", linkend: "</a>" }));
                    this.infoHelpfulLinks = this.gettextCatalog.getString("Helpful links:"); 
                    this.infoFacebookLink = this.$sce.trustAsHtml(this.gettextCatalog.getString("Interact with other users in our {{link}}Facebook group{{linkend}}", { link: "<a href='https://www.facebook.com/groups/994960670559126/' target='_blank'>", linkend: "</a>" }));
                    this.infoGithubLink = this.$sce.trustAsHtml(this.gettextCatalog.getString("Request features and report bugs on our {{link}}Github project{{linkend}} page", { link: "<a href='http://www.github.com/IsraelHikingMap' target='_blank'>", linkend: "</a>" }));
                    this.infoOsmWikiLink = this.$sce.trustAsHtml(this.gettextCatalog.getString("Learn Israel-specific mapping rules at the {{link}}Israel OSM Wiki Project{{linkend}}", { link: "<a href='http://wiki.openstreetmap.org/wiki/WikiProject_Israel' target='_blank'>", linkend: "</a>" }));
                    this.infoOruxmapDownloadLink = this.$sce.trustAsHtml(this.gettextCatalog.getString("Download {{link}}Offline maps{{linkend}} directly to your android device for use with the OruxMaps application", { link: "<a href='http://israelhiking.osm.org.il/OruxmapsDownload.html' target='_blank'>", linkend: "</a>" }));
                    this.infoFooterThanks = this.gettextCatalog.getString("Thank you for your support!");
                    this.infoFooterHarelAndZeev = this.gettextCatalog.getString("Harel and Zeev");
                    // Legend
                    this.legendMarkedTrails = this.gettextCatalog.getString("Marked Trails");
                    this.legendRedMarkedTrail = this.gettextCatalog.getString("Red marked trail");
                    this.legendBlueMarkedTrail = this.gettextCatalog.getString("Blue marked trail");
                    this.legendGreenMarkedTrail = this.gettextCatalog.getString("Green marked trail");
                    this.legendBlackMarkedTrail = this.gettextCatalog.getString("Black marked trail");
                    this.legendIsraelTrail = this.gettextCatalog.getString("Israel Trail");
                    this.legendRegionalTrail = this.gettextCatalog.getString("Regional trail");
                    this.legendTrails = this.gettextCatalog.getString("Trails");
                    this.legendAllVehicles = this.gettextCatalog.getString("All vehicles");
                    this.legendLight4WDVehicles = this.gettextCatalog.getString("Light 4WD vehicles");
                    this.legendStrong4WDVehicles = this.gettextCatalog.getString("Strong 4WD vehicles");
                    this.legendDifficult4WD = this.gettextCatalog.getString("Difficult 4WD"); // עבירות קשה  
                    this.legendPath = this.gettextCatalog.getString("Path");
                    this.legendFootPath = this.gettextCatalog.getString("Foot path");
                    this.legendBicyclePath = this.gettextCatalog.getString("Bicycle path");
                    this.legendSteps = this.gettextCatalog.getString("Steps"); // מדרגות
                    this.legendWater = this.gettextCatalog.getString("Water"); // מים
                    this.legendStream = this.gettextCatalog.getString("Stream"); // נחל איתן
                    this.legendWadi = this.gettextCatalog.getString("Wadi"); // נחל אכזה
                    this.legendRiver = this.gettextCatalog.getString("Water"); // נהר
                    this.legendLakeReservoir = this.gettextCatalog.getString("Lake, Reservoir"); //  מקווה מים
                    this.legendSeasonalLake = this.gettextCatalog.getString("Seasonal Lake, Reservoir, or Riverbed"); // אגם ומאגר עונתיים, נחל אכזב
                    this.legendSpringPond = this.gettextCatalog.getString("Spring, Pond"); //מעיין, בריכה
                    this.legendWaterHole = this.gettextCatalog.getString("Waterhole"); //גב
                    this.legendWaterWell = this.gettextCatalog.getString("Water Well"); //באר
                    this.legendCistern = this.gettextCatalog.getString("Cistern"); // בור
                    this.legendWaterfall = this.gettextCatalog.getString("Waterfall"); // מפל
                    this.legendWaterTower = this.gettextCatalog.getString("Water Tower"); // מגדל מים
                    this.legendRoads = this.gettextCatalog.getString("Roads");
                    this.legendMotorway = this.gettextCatalog.getString("Motorway");
                    this.legendTrunk = this.gettextCatalog.getString("Trunk");
                    this.legendPrimary = this.gettextCatalog.getString("Primary");
                    this.legendSecondary = this.gettextCatalog.getString("Secondary");
                    this.legendTertiary = this.gettextCatalog.getString("Tertiary");
                    this.legendUnclassified = this.gettextCatalog.getString("Unclassified");
                    this.legendRailway = this.gettextCatalog.getString("Railway");
                    this.legendRunwayTaxiway = this.gettextCatalog.getString("Runway and Taxiway");
                    this.legendPoi = this.gettextCatalog.getString("Points of Interest");
                    this.legendPicnicArea = this.gettextCatalog.getString("Picnic Area");
                    this.legendCampsite = this.gettextCatalog.getString("Campsite");
                    this.legendViewpoint = this.gettextCatalog.getString("Viewpoint");
                    this.legendPeak = this.gettextCatalog.getString("Peak");
                    this.legendRuins = this.gettextCatalog.getString("Ruins");
                    this.legendArcheologicalSite = this.gettextCatalog.getString("Archeological Site");
                    this.legendCave = this.gettextCatalog.getString("Cave");
                    this.legendRegionalTrails = this.gettextCatalog.getString("Regional Trails");
                    this.legendJerusalemTrail = this.gettextCatalog.getString("Jerusalem Trail");
                    this.legendSeatoSeaTrail = this.gettextCatalog.getString("Sea to Sea Trail");
                    this.legendGolanTrail = this.gettextCatalog.getString("Golan Trail");
                    this.legendKinneretTrail = this.gettextCatalog.getString("Kinneret Trail");
                    this.legendHaifaWadisTrail = this.gettextCatalog.getString("Haifa Wadis Trail");
                    this.legendKinneretBicycleTrail = this.gettextCatalog.getString("Kinneret Bicycle Trail");
                    this.legendPurpleRegionalTrail = this.gettextCatalog.getString("Purple Regional Trail");
                    this.legendOrangeRegionalTrail = this.gettextCatalog.getString("Orange Regional Trail");
                    this.legendSingles = this.gettextCatalog.getString("Singles");
                    this.legendUnknownScale = this.gettextCatalog.getString("Unknown Scale");
                    this.legendEasyWithDirection = this.gettextCatalog.getString("Easy with Direction");
                    this.legendModerate = this.gettextCatalog.getString("Moderate");
                    this.legendAdvanced = this.gettextCatalog.getString("Advanced");
                    this.legendChallangingWithDirection = this.gettextCatalog.getString("Challanging with Direction");
                    this.legendBicycleTrails = this.gettextCatalog.getString("Bicycle Trails");
                    this.legendLocalTrail = this.gettextCatalog.getString("Local Trail");
                    this.legendNationalTrail = this.gettextCatalog.getString("National Trail");

                    this.currentLanguage = language;
                });
        }
    }
}