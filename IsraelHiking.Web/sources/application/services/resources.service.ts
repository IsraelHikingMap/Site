import { Injectable } from "@angular/core";
import { Direction } from "@angular/cdk/bidi";
import { Subject } from "rxjs";
import { LocalStorage } from "ngx-store";
import { GetTextCatalogService } from "./gettext-catalog.service";
import { Urls } from "../common/Urls";
export type LanguageCode = "en-US" | "he";

export interface ILanguage {
    code: LanguageCode;
    rtl: boolean;
    label: string;
    tilesFolder: string;
}

@Injectable()
export class ResourcesService {
    @LocalStorage()
    public currentLanguage: ILanguage = null;
    public availableLanguages: ILanguage[];
    public languageChanged: Subject<any>;

    public direction: Direction;
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
    public addPointToRoute: string;
    public removeSearchResults: string;
    public israelMTBMap: string;
    public israelHikingMap: string;
    public googleEarth: string;
    public hikingTrails: string;
    public wiki: string;
    public route: string;
    public from: string;
    public to: string;
    public directionalSearch: string;
    public regularSearch: string;
    public moveToRoute: string;
    public unknownUser: string;
    public myTraces: string;
    public noTraces: string;
    public myShares: string;
    public noShares: string;
    public title: string;
    public titlePlaceHolder: string;
    public description: string;
    public descriptionPlaceHolder: string;
    public osmLoginExplenation: string;
    public application: string;
    public map: string;
    public startDownload: string;
    public views: string;
    public lastViewed: string;
    public detailsLevel: string;
    public upToZoom: string;
    public installationInstructions: string;
    public offlineMapBenifits: string;
    public installationInstructionsMobileOruxMaps: string;
    public installationInstructionsMobileLocus: string;
    public installationInstructionsMobileOffroad: string;
    public installationInstructionsDesktopOruxMaps: string;
    public installationInstructionsDesktopLocus: string;
    public installationInstructionsDesktopOffroad: string;
    public mapsAreUpdatedEveryTwoDays: string;
    public junior: string;
    public partner: string;
    public master: string;
    public guru: string;
    public changes: string;
    public userEmail: string;
    public userEmailMutedOffroad: string;
    public difficulty: string;
    public easy: string;
    public moderate: string;
    public hard: string;
    public activity: string;
    public send: string;
    public view: string;
    public edit: string;
    public update: string;
    public copyUrl: string;
    public delete: string;
    public editRouteDetails: string;
    public shareWithFacebook: string;
    public shareWithWhatsapp: string;
    public shareWithOffroad: string;
    public findUnmappedRoutes: string;
    public nonMarkedTrail: string;
    public dirtRoad: string;
    public addThisRouteToOsm: string;
    public uploadFileToOsm: string;
    public selectIcon: string;
    public nakeb: string;
    public split: string;
    public merge: string;
    public public: string;
    public private: string;
    public tags: string;
    public noTags: string;
    public moreMapAddresses: string;
    public categories: string;
    public emptyPoiDescription: string;
    public comingSoon: string;
    public itsYourTimeToShine: string;
    public worthIt: string;
    public notWorthIt: string;
    public loading: string;
    public natural: string;
    public camping: string;
    public other: string;
    public uploadPoint: string;
    public updatePoint: string;
    public addPoint: string;
    public spring: string;
    public historic: string;
    public website: string;
    public aLinkToAWebsite: string;
    public clickToUpload: string;
    public clickToEdit: string;
    public more: string;
    public routes: string;
    public hiking: string;
    public bicycle: string;
    public termsOfService: string;
    public termsOfServiceElaborated: string;
    public osmTermsOfService: string;
    public wikimediaTermsOfService: string;
    public iHaveReadAndAgree: string;
    public submit: string;
    public esri: string;
    public suggestAsPublicTrack: string;
    public createNakebHike: string;
    public flowers: string;
    public updateCurrentShare: string;
    public generateMarkersForAllPoints: string;
    public yes: string;
    public no: string;
    public ok: string;
    public cancel: string;
    public areYouSure: string;
    public deletionOf: string;
    public myProfile: string;
    public login: string;
    public logout: string;
    public openInANewWindow: string;
    public addLink: string;
    public baseLayers: string;
    public overlays: string;
    public privateRoutes: string;
    // Toasts: Errors/Warnings/Success
    public unableToGetSearchResults: string;
    public pleaseSelectFrom: string;
    public pleaseSelectTo: string;
    public routeIsHidden: string;
    public pleaseAddPointsToRoute: string;
    public unableToSaveToFile: string;
    public unableToLoadFromFile: string;
    public unableToLoadFromUrl: string;
    public routeNameAlreadyInUse: string;
    public unableToGenerateUrl: string;
    public unableToGetElevationData: string;
    public unableToGetDataForSnapping: string;
    public routingFailed: string;
    public pleaseSelectARoute: string;
    public pleaseAddRoutePoints: string;
    public unableToLogin: string;
    public routeSentSuccessfully: string;
    public unableToSendRoute: string;
    public noUnmappedRoutes: string;
    public unableToFindYourLocation: string;
    public redirectingToSecuredSite: string;
    public routeAddedSuccessfullyItWillTakeTime: string;
    public fileUploadedSuccefullyItWillTakeTime: string;
    public unableToUploadFile: string;
    public unableToSaveAnEmptyRoute: string;
    public closeWhileInEditMode: string;
    public dataUpdatedSuccefully: string;
    public loginRequired: string;
    public noDescriptionLoginRequired: string;
    public nameInLanguage: string;
    public descriptionInLanguage: string;
    public unableToSaveData: string;
    public nameIsAlreadyInUse: string;
    public baseLayerAndOverlayAreOverlapping: string;
    public unableToFindPoi: string;
    public wouldYouLikeToUpdate: string;
    public wouldYouLikeToUpdateThePointWithoutTheTitle: string;
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
    public infoDownloadMapForOfflineUse: string;
    public infoOsmWikiLink: string;
    public infoFooterThanks: string;
    public infoFooterAuthors: string;
    // Legend
    public legendMarkedTrails: string;
    public legendRedMarkedTrail: string;
    public legendBlueMarkedTrail: string;
    public legendGreenMarkedTrail: string;
    public legendBlackMarkedTrail: string;
    public legendUnmarkedTrail: string;
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
    public legendLowSpeedStreet: string;
    public legendResidental: string;
    public legendBridge: string;
    public legendTunnel: string;
    public legendTransportation: string;
    public legendRailway: string;
    public legendRailwayTunnel: string;
    public legendRailwayStation: string;
    public legendRunwayTaxiway: string;
    public legendAerialway: string;
    public legendPoi: string;
    public legendPicnicArea: string;
    public legendCampsite: string;
    public legendDrinkingWater: string;
    public legendCafé: string;
    public legendReastaurant: string;
    public legendParking: string;
    public legendFuelStation: string;
    public legendConvenienceStore: string;
    public legendLodging: string;
    public legendToilettes: string;
    public legendInformationCenter: string;
    public legendGuidepost: string;
    public legendConstructionSite: string;
    public legendViewpoint: string;
    public legendPeak: string;
    public legendRuins: string;
    public legendArcheologicalSite: string;
    public legendCave: string;
    public legendAttraction: string;
    public legendTree: string;
    public legendSynagogue: string;
    public legendChurch: string;
    public legendMosque: string;
    public legendHolyPlace: string;
    public legendMemorial: string;
    public legendMonument: string;
    public legendObservationTower: string;
    public legendAntenna: string;
    public legendPowerLine: string;
    public legendPlayground: string;
    public legendBarriers: string;
    public legendGate: string;
    public legendClosedGate: string;
    public legendStile: string;
    public legendBlock: string;
    public legendLiftGate: string;
    public legendCattleGrid: string;
    public legendFence: string;
    public legendWall: string;
    public legendCliff: string;
    public legendBorders: string;
    public legendBikePark: string;
    public legendNatureReserveNationalPark: string;
    public legendMilitaryArea: string;
    public legendAreaA: string;
    public legendAreaB: string;
    public legendInternationalBorder: string;
    public legendTheGreenLine: string;
    public legendThePurpleLine: string;
    public legendAmenities: string;
    public legendBikeShop: string;
    public legendFirstAid: string;
    public legendRegionalTrails: string;
    public legendJerusalemTrail: string;
    public legendSeaToSeaTrail: string;
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
    public legendAreas: string;
    public legendCitySettelment: string;
    public legendOrchard: string;
    public legendCrop: string;
    public legendWoods: string;
    public legendGrass: string;
    public legendScrub: string;
    public legendSand: string;
    public legendWetland: string;
    public legendDryRiverbed: string;
    public legendCemetary: string;
    public legendQuarry: string;
    public legendEmpty: string;

    constructor(private gettextCatalog: GetTextCatalogService) {
        this.availableLanguages = [
            {
                code: "he",
                rtl: true,
                label: "עברית",
                tilesFolder: "/Hebrew"
            },
            {
                code: "en-US",
                rtl: false,
                label: "English",
                tilesFolder: "/English"
            }
        ];
        this.languageChanged = new Subject<{}>();
        if (!this.currentLanguage) {
            this.currentLanguage = this.availableLanguages[0];
        }
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

    public setLanguage = async (language: ILanguage): Promise<any> => {
        this.setRtl(language.rtl);
        this.gettextCatalog.setCurrentLanguage(language.code);
        await this.gettextCatalog.loadRemote(Urls.translations + language.code + ".json");

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
        this.coordinatesForWikipedia = this.gettextCatalog.getString("Coordinates for {{link}}Wikipedia{{linkend}}")
            .replace("{{link}}", `<a href="https://${this.currentLanguage.code.split("-")[0]}.wikipedia.org/" target="_blank">`)
            .replace("{{linkend}}", "</a>");
        // end
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
        this.copyPasteEmbdExplenation = this.gettextCatalog
            .getString("Copy and paste the code below in order to show this map on your webpage.");
        this.html = this.gettextCatalog.getString("HTML");
        this.close = this.gettextCatalog.getString("Close");
        this.northAbbreviation = this.gettextCatalog.getString("N");
        this.eastAbbreviation = this.gettextCatalog.getString("E");
        this.latitudeAbbreviation = this.gettextCatalog.getString("Lat");
        this.longitudeAbbreviation = this.gettextCatalog.getString("Lon");
        this.layerNamePlaceHolder = this.gettextCatalog.getString("A name to be displayed in the layers controller");
        this.shareYourWork = this.gettextCatalog.getString("Share Your Work");
        this.language = this.gettextCatalog.getString("Language");
        this.elevation = this.gettextCatalog.getString("Elevation");
        this.slope = this.gettextCatalog.getString("Slope");
        this.convertToRoute = this.gettextCatalog.getString("Convert to Route");
        this.addPointToRoute = this.gettextCatalog.getString("Add Point to Route");
        this.removeSearchResults = this.gettextCatalog.getString("Remove Search Results");
        this.israelMTBMap = this.gettextCatalog.getString("Israel MTB Map");
        this.israelHikingMap = this.gettextCatalog.getString("Israel Hiking Map");
        this.googleEarth = this.gettextCatalog.getString("Google Earth");
        this.hikingTrails = this.gettextCatalog.getString("Hiking Trails");
        this.route = this.gettextCatalog.getString("Route");
        this.from = this.gettextCatalog.getString("From");
        this.to = this.gettextCatalog.getString("To");
        this.directionalSearch = this.gettextCatalog.getString("Directional Search");
        this.regularSearch = this.gettextCatalog.getString("Regular Search");
        this.moveToRoute = this.gettextCatalog.getString("Move to Route");
        this.unknownUser = this.gettextCatalog.getString("Unknown User");
        this.myTraces = this.gettextCatalog.getString("My Traces");
        this.noTraces = this.gettextCatalog.getString("No traces, you should really upload some to OSM.");
        this.myShares = this.gettextCatalog.getString("My Shares");
        this.noShares = this.gettextCatalog.getString("No shares, now is the time to start sharing your work!");
        this.title = this.gettextCatalog.getString("Title");
        this.titlePlaceHolder = this.gettextCatalog.getString("The title for your share.");
        this.description = this.gettextCatalog.getString("Description");
        this.descriptionPlaceHolder = this.gettextCatalog.getString("A few words about what you are sharing.");
        this.osmLoginExplenation = this.gettextCatalog
            .getString("Click on the frowny-face to login to OSM. We'll make it worth your while!");
        this.application = this.gettextCatalog.getString("Application");
        this.map = this.gettextCatalog.getString("Map");
        this.startDownload = this.gettextCatalog.getString("Start Download");
        this.views = this.gettextCatalog.getString("Views");
        this.lastViewed = this.gettextCatalog.getString("Last Viewed");
        this.detailsLevel = this.gettextCatalog.getString("Details Level");
        this.upToZoom = this.gettextCatalog.getString("Up to zoom");
        this.installationInstructions = this.gettextCatalog.getString("Installation Instructions");
        this.offlineMapBenifits = this.gettextCatalog
            .getString("The download may take several minutes, " +
                "and afterwards you can enjoy the map with no need for a network connection.");
        this.installationInstructionsMobileOruxMaps = this.gettextCatalog
            .getString("Installation instructions for OruxMaps on mobile - surround each new line with <li></li>");
        this.installationInstructionsMobileLocus = this.gettextCatalog
            .getString("Installation instructions for Locus on mobile - surround each new line with <li></li>");
        this.installationInstructionsMobileOffroad = this.gettextCatalog
            .getString("Installation instructions for Offroad on mobile - surround each new line with <li></li>");
        this.installationInstructionsDesktopOruxMaps = this.gettextCatalog
            .getString("Installation instructions for OruxMaps on desktop - surround each new line with <li></li>");
        this.installationInstructionsDesktopLocus = this.gettextCatalog
            .getString("Installation instructions for Locus on desktop - surround each new line with <li></li>");
        this.installationInstructionsDesktopOffroad = this.gettextCatalog
            .getString("Installation instructions for Offroad on desktop - surround each new line with <li></li>");
        // end
        this.mapsAreUpdatedEveryTwoDays = this.gettextCatalog.getString("Maps are updated every two days");
        this.junior = this.gettextCatalog.getString("Junior");
        this.partner = this.gettextCatalog.getString("Partner");
        this.master = this.gettextCatalog.getString("Master");
        this.guru = this.gettextCatalog.getString("Guru");
        this.changes = this.gettextCatalog.getString("Changes");
        this.userEmail = this.gettextCatalog.getString("User E-Mail");
        this.userEmailMutedOffroad = this.gettextCatalog.getString("Use the e-mail you used to login to off-road app.");
        this.difficulty = this.gettextCatalog.getString("Difficulty");
        this.easy = this.gettextCatalog.getString("Easy");
        this.moderate = this.gettextCatalog.getString("Moderate");
        this.hard = this.gettextCatalog.getString("Hard");
        this.activity = this.gettextCatalog.getString("Activity");
        this.send = this.gettextCatalog.getString("Send!");
        this.view = this.gettextCatalog.getString("View");
        this.edit = this.gettextCatalog.getString("Edit");
        this.update = this.gettextCatalog.getString("Update");
        this.copyUrl = this.gettextCatalog.getString("Copy Link");
        this.delete = this.gettextCatalog.getString("Delete");
        this.editRouteDetails = this.gettextCatalog.getString("Edit Route Details");
        this.shareWithFacebook = this.gettextCatalog.getString("Share With Facebook");
        this.shareWithWhatsapp = this.gettextCatalog.getString("Share With WhatsApp");
        this.shareWithOffroad = this.gettextCatalog.getString("Share With off-road");
        this.findUnmappedRoutes = this.gettextCatalog.getString("Find Unmapped Routes");
        this.nonMarkedTrail = this.gettextCatalog.getString("Non-Marked Trail");
        this.dirtRoad = this.gettextCatalog.getString("Dirt Road");
        this.addThisRouteToOsm = this.gettextCatalog.getString("Add This Route to OSM");
        this.uploadFileToOsm = this.gettextCatalog.getString("Upload a trace");
        this.selectIcon = this.gettextCatalog.getString("Select Icon");
        this.nakeb = this.gettextCatalog.getString("Nakeb");
        this.split = this.gettextCatalog.getString("Split");
        this.merge = this.gettextCatalog.getString("Merge");
        this.public = this.gettextCatalog.getString("Public");
        this.private = this.gettextCatalog.getString("Private");
        this.tags = this.gettextCatalog.getString("Tags");
        this.noTags = this.gettextCatalog.getString("No Tags");
        this.moreMapAddresses = this.gettextCatalog.getString("More map addresses can be found here, look for TMS");
        this.categories = this.gettextCatalog.getString("Categories");
        this.emptyPoiDescription = this.gettextCatalog.getString("You should add your description here! Click the edit button above.");
        this.comingSoon = this.gettextCatalog.getString("Coming Soon!");
        this.itsYourTimeToShine = this.gettextCatalog.getString("Its your time to shine!");
        this.worthIt = this.gettextCatalog.getString("Worth it!");
        this.notWorthIt = this.gettextCatalog.getString("Not worth it...");
        this.loading = this.gettextCatalog.getString("Loading...");
        this.natural = this.gettextCatalog.getString("Natural");
        this.camping = this.gettextCatalog.getString("Camping");
        this.other = this.gettextCatalog.getString("Other");
        this.uploadPoint = this.gettextCatalog.getString("Upload Point");
        this.updatePoint = this.gettextCatalog.getString("Update Point");
        this.addPoint = this.gettextCatalog.getString("Add Point");
        this.spring = this.gettextCatalog.getString("Spring");
        this.historic = this.gettextCatalog.getString("Historic");
        this.website = this.gettextCatalog.getString("Website");
        this.aLinkToAWebsite = this.gettextCatalog.getString("A link to a website");
        this.clickToUpload = this.gettextCatalog.getString("Click to Upload");
        this.clickToEdit = this.gettextCatalog.getString("Click to Edit");
        this.more = this.gettextCatalog.getString("More...");
        this.routes = this.gettextCatalog.getString("Routes");
        this.hiking = this.gettextCatalog.getString("Hiking");
        this.bicycle = this.gettextCatalog.getString("Bicycle");
        this.termsOfService = this.gettextCatalog.getString("Terms of Service");
        this.termsOfServiceElaborated = this.gettextCatalog.getString("Elaborated terms of service of this site, OSM and wikimedia");
        this.osmTermsOfService = this.gettextCatalog.getString("OSM terms of service");
        this.wikimediaTermsOfService = this.gettextCatalog.getString("Wikimedia terms of service");
        this.iHaveReadAndAgree = this.gettextCatalog.getString("I have read and agree to the terms");
        this.submit = this.gettextCatalog.getString("Submit");
        this.esri = this.gettextCatalog.getString("ESRI");
        this.suggestAsPublicTrack = this.gettextCatalog.getString("Suggest as public track");
        this.createNakebHike = this.gettextCatalog.getString("Create new hike in Nakeb");
        this.flowers = this.gettextCatalog.getString("Flowers");
        this.updateCurrentShare = this.gettextCatalog.getString("Update current share");
        this.generateMarkersForAllPoints = this.gettextCatalog.getString("Generate markers for all route points");
        this.yes = this.gettextCatalog.getString("Yes");
        this.no = this.gettextCatalog.getString("No");
        this.ok = this.gettextCatalog.getString("OK");
        this.cancel = this.gettextCatalog.getString("Cancel");
        this.areYouSure = this.gettextCatalog.getString("Are you sure?");
        this.deletionOf = this.gettextCatalog.getString("Deletion of");
        this.myProfile = this.gettextCatalog.getString("My profile");
        this.login = this.gettextCatalog.getString("Login");
        this.logout = this.gettextCatalog.getString("Logout");
        this.openInANewWindow = this.gettextCatalog.getString("Open in a new window");
        this.addLink = this.gettextCatalog.getString("Add link");
        this.baseLayers = this.gettextCatalog.getString("Base Layers");
        this.overlays = this.gettextCatalog.getString("Overlays");
        this.privateRoutes = this.gettextCatalog.getString("Private Routes");
        // Toasts: Errors/Warnings/Success
        this.unableToGetSearchResults = this.gettextCatalog.getString("Unable to get search results...");
        this.pleaseSelectFrom = this.gettextCatalog.getString("Please select from...");
        this.pleaseSelectTo = this.gettextCatalog.getString("Please select to...");
        this.routeIsHidden = this.gettextCatalog.getString("Route is hidden...");
        this.pleaseAddPointsToRoute = this.gettextCatalog.getString("Please add points to route...");
        this.unableToSaveToFile = this.gettextCatalog.getString("Unable to save to file...");
        this.unableToLoadFromFile = this.gettextCatalog.getString("Unable to extract geographic information from the file...");
        this.unableToLoadFromUrl = this.gettextCatalog.getString("Unable to load from URL...");
        this.routeNameAlreadyInUse = this.gettextCatalog.getString("The route's name was altered since it is in use...");
        this.unableToGenerateUrl = this.gettextCatalog.getString("Unable to generate URL, please try again later...");
        this.unableToGetElevationData = this.gettextCatalog.getString("Unable to get elevation data:");
        this.unableToGetDataForSnapping = this.gettextCatalog.getString("Unable to get data for snapping...");
        this.routingFailed = this.gettextCatalog.getString("Routing failed:");
        this.pleaseSelectARoute = this.gettextCatalog.getString("Please select a route...");
        this.pleaseAddRoutePoints = this.gettextCatalog.getString("Please add points to the route...");
        this.unableToLogin = this.gettextCatalog.getString("Unable to login...");
        this.routeSentSuccessfully = this.gettextCatalog.getString("Route sent successfully.");
        this.unableToSendRoute = this.gettextCatalog.getString("Unable to send route...");
        this.noUnmappedRoutes = this.gettextCatalog.getString("No unmapped routes! :-)");
        this.unableToFindYourLocation = this.gettextCatalog.getString("Unable to find your location...");
        this.redirectingToSecuredSite = this.gettextCatalog.getString("Redirecting to secure site.");
        this.routeAddedSuccessfullyItWillTakeTime = this.gettextCatalog
            .getString("Route added successfully, It will take some time for the map to update.");
        this.fileUploadedSuccefullyItWillTakeTime = this.gettextCatalog
            .getString("File uploaded successfully, It will take some time to add it to OSM database.");
        this.unableToUploadFile = this.gettextCatalog.getString("Unable to upload the file...");
        this.unableToSaveAnEmptyRoute = this.gettextCatalog
            .getString("Unable to save an empty route, Please try and select a different one from the layers control on your left.");
        this.closeWhileInEditMode = this.gettextCatalog
            .getString("Please note that you did not save your work before closing the popup...");
        this.dataUpdatedSuccefully = this.gettextCatalog.getString("The data was updated successfully!");
        this.loginRequired = this.gettextCatalog
            .getString("You need to login to OSM first, please use the button in the upper right corner to login.");
        this.noDescriptionLoginRequired = this.gettextCatalog
            .getString("There's no description :-(. To add one you'll need to login to OSM first, " +
                "please use the button in the upper right corner to login.");
        this.nameInLanguage = this.gettextCatalog.getString("Name in {{translation language}}");
        this.descriptionInLanguage = this.gettextCatalog.getString("Description in {{translation language}}");
        this.unableToSaveData = this.gettextCatalog.getString("Unable to save data, please try again later...");
        this.nameIsAlreadyInUse = this.gettextCatalog.getString("This name is already in use");
        this.baseLayerAndOverlayAreOverlapping = this.gettextCatalog.getString("Base layer and overlay are overlapping.");
        this.unableToFindPoi = this.gettextCatalog.getString("Unable to find the required point of interest...");
        this.wouldYouLikeToUpdate = this.gettextCatalog.getString("Would you like to update:");
        this.wouldYouLikeToUpdateThePointWithoutTheTitle = this.gettextCatalog
            .getString("Would you like to update the point without the title?");
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
        this.helpYoutubeLink = this.gettextCatalog
            .getString("Learn how to add and edit OpenStreetMap maps with our {{link}}YouTube tutorials{{linkend}}.")
            .replace("{{link}}", "<a href='https://www.youtube.com/playlist?list=PL8pYDecWd7EjQIyJpPAwSH3UbeZzzQpNo' target='_blank'>")
            .replace("{{linkend}}", "</a>");
        // Info
        this.infoHelpfulLinks = this.gettextCatalog.getString("Helpful links:");
        this.infoSubheader = this.gettextCatalog
            .getString("This map was generated from {{link}}Open Street Map (OSM){{linkend}} data which is free for all to use and edit.")
            .replace("{{link}}", "<a dir='ltr' href='https://www.openstreetmap.org/' target='_blank'>")
            .replace("{{linkend}}", "</a>");
        this.infoFacebookLink = this.gettextCatalog
            .getString("Interact with other users in our {{link}}Facebook group{{linkend}}")
            .replace("{{link}}", "<a href='https://www.facebook.com/groups/994960670559126/' target='_blank'>")
            .replace("{{linkend}}", "</a>");
        this.infoGithubLink = this.gettextCatalog
            .getString("Request features and report bugs on our {{link}}Github project{{linkend}} page")
            .replace("{{link}}", "<a href='http://www.github.com/IsraelHikingMap' target='_blank'>")
            .replace("{{linkend}}", "</a>");
        this.infoOsmWikiLink = this.gettextCatalog
            .getString("Learn Israel-specific mapping rules at the {{link}}Israel OSM Wiki Project{{linkend}}")
            .replace("{{link}}", "<a href='http://wiki.openstreetmap.org/wiki/WikiProject_Israel' target='_blank'>")
            .replace("{{linkend}}", "</a>");
        // end
        this.infoDownloadMapForOfflineUse = this.gettextCatalog.getString("Download Map for Offline Use");
        this.infoFooterThanks = this.gettextCatalog.getString("Thank you for your support!");
        this.infoFooterAuthors = this.gettextCatalog.getString("Harel, Zeev and Guy");
        // Legend
        this.legendMarkedTrails = this.gettextCatalog.getString("Marked Trails");
        this.legendRedMarkedTrail = this.gettextCatalog.getString("Red Marked Trail");
        this.legendBlueMarkedTrail = this.gettextCatalog.getString("Blue Marked Trail");
        this.legendGreenMarkedTrail = this.gettextCatalog.getString("Green Marked Trail");
        this.legendBlackMarkedTrail = this.gettextCatalog.getString("Black Marked Trail");
        this.legendUnmarkedTrail = this.gettextCatalog.getString("Unarked Trail");
        this.legendIsraelTrail = this.gettextCatalog.getString("Israel Trail");
        this.legendRegionalTrail = this.gettextCatalog.getString("Regional Trail");
        this.legendTrails = this.gettextCatalog.getString("Trails");
        this.legendAllVehicles = this.gettextCatalog.getString("All Vehicles");
        this.legendLight4WDVehicles = this.gettextCatalog.getString("Light 4WD Vehicles");
        this.legendStrong4WDVehicles = this.gettextCatalog.getString("Strong 4WD Vehicles");
        this.legendDifficult4WD = this.gettextCatalog.getString("Difficult 4WD");
        this.legendPath = this.gettextCatalog.getString("Path");
        this.legendFootPath = this.gettextCatalog.getString("Foot Path");
        this.legendBicyclePath = this.gettextCatalog.getString("Bicycle Path");
        this.legendSteps = this.gettextCatalog.getString("Steps");
        this.legendWater = this.gettextCatalog.getString("Water");
        this.legendStream = this.gettextCatalog.getString("Stream");
        this.legendWadi = this.gettextCatalog.getString("Wadi");
        this.legendRiver = this.gettextCatalog.getString("River");
        this.legendLakeReservoir = this.gettextCatalog.getString("Lake, Reservoir");
        this.legendSeasonalLake = this.gettextCatalog.getString("Seasonal Lake, Reservoir, or Riverbed");
        this.legendSpringPond = this.gettextCatalog.getString("Spring, Pond");
        this.legendWaterHole = this.gettextCatalog.getString("Waterhole");
        this.legendWaterWell = this.gettextCatalog.getString("Water Well");
        this.legendCistern = this.gettextCatalog.getString("Cistern");
        this.legendWaterfall = this.gettextCatalog.getString("Waterfall");
        this.legendWaterTower = this.gettextCatalog.getString("Water Tower");
        this.legendRoads = this.gettextCatalog.getString("Roads");
        this.legendMotorway = this.gettextCatalog.getString("Motorway");
        this.legendTrunk = this.gettextCatalog.getString("Trunk");
        this.legendPrimary = this.gettextCatalog.getString("Primary");
        this.legendSecondary = this.gettextCatalog.getString("Secondary");
        this.legendTertiary = this.gettextCatalog.getString("Tertiary");
        this.legendUnclassified = this.gettextCatalog.getString("Unclassified");
        this.legendLowSpeedStreet = this.gettextCatalog.getString("Low-Speed Street");
        this.legendResidental = this.gettextCatalog.getString("Residental");
        this.legendBridge = this.gettextCatalog.getString("Bridge");
        this.legendTunnel = this.gettextCatalog.getString("Tunnel");
        this.legendTransportation = this.gettextCatalog.getString("Transportation");
        this.legendRailway = this.gettextCatalog.getString("Railway");
        this.legendRailwayTunnel = this.gettextCatalog.getString("Railway Tunnel");
        this.legendRailwayStation = this.gettextCatalog.getString("Railway Station");
        this.legendRunwayTaxiway = this.gettextCatalog.getString("Runway and Taxiway");
        this.legendAerialway = this.gettextCatalog.getString("Aerialway");
        this.legendPoi = this.gettextCatalog.getString("Points of Interest");
        this.legendPicnicArea = this.gettextCatalog.getString("Picnic Area");
        this.legendCampsite = this.gettextCatalog.getString("Campsite");
        this.legendDrinkingWater = this.gettextCatalog.getString("Drinking Water");
        this.legendCafé = this.gettextCatalog.getString("Café");
        this.legendReastaurant = this.gettextCatalog.getString("Reastaurant");
        this.legendParking = this.gettextCatalog.getString("Parking");
        this.legendFuelStation = this.gettextCatalog.getString("Fuel Station");
        this.legendConvenienceStore = this.gettextCatalog.getString("Convenience Store");
        this.legendLodging = this.gettextCatalog.getString("Lodging");
        this.legendToilettes = this.gettextCatalog.getString("Toilettes");
        this.legendInformationCenter = this.gettextCatalog.getString("Information Center");
        this.legendGuidepost = this.gettextCatalog.getString("Guidepost");
        this.legendViewpoint = this.gettextCatalog.getString("Viewpoint");
        this.legendPeak = this.gettextCatalog.getString("Peak");
        this.legendRuins = this.gettextCatalog.getString("Ruins");
        this.legendArcheologicalSite = this.gettextCatalog.getString("Archeological Site");
        this.legendCave = this.gettextCatalog.getString("Cave");
        this.legendAttraction = this.gettextCatalog.getString("Attraction");
        this.legendTree = this.gettextCatalog.getString("Tree");
        this.legendSynagogue = this.gettextCatalog.getString("Synagogue");
        this.legendChurch = this.gettextCatalog.getString("Church");
        this.legendMosque = this.gettextCatalog.getString("Mosque");
        this.legendHolyPlace = this.gettextCatalog.getString("Holy Place");
        this.legendMemorial = this.gettextCatalog.getString("Memorial");
        this.legendMonument = this.gettextCatalog.getString("Monument");
        this.legendObservationTower = this.gettextCatalog.getString("Observation Tower");
        this.legendAntenna = this.gettextCatalog.getString("Antenna");
        this.legendPowerLine = this.gettextCatalog.getString("Power Line");
        this.legendPlayground = this.gettextCatalog.getString("Playground");
        this.legendBarriers = this.gettextCatalog.getString("Barriers");
        this.legendGate = this.gettextCatalog.getString("Gate");
        this.legendClosedGate = this.gettextCatalog.getString("Closed Gate");
        this.legendStile = this.gettextCatalog.getString("Stile");
        this.legendBlock = this.gettextCatalog.getString("Block");
        this.legendLiftGate = this.gettextCatalog.getString("Lift Gate");
        this.legendCattleGrid = this.gettextCatalog.getString("Cattle Grid");
        this.legendFence = this.gettextCatalog.getString("Fence");
        this.legendWall = this.gettextCatalog.getString("Wall");
        this.legendCliff = this.gettextCatalog.getString("Cliff");
        this.legendBorders = this.gettextCatalog.getString("Borders");
        this.legendBikePark = this.gettextCatalog.getString("Bike Park");
        this.legendNatureReserveNationalPark = this.gettextCatalog.getString("Nature Reserve, National Park");
        this.legendMilitaryArea = this.gettextCatalog.getString("Military Area");
        this.legendAreaA = this.gettextCatalog.getString("Area A");
        this.legendAreaB = this.gettextCatalog.getString("Area B");
        this.legendInternationalBorder = this.gettextCatalog.getString("International Border");
        this.legendTheGreenLine = this.gettextCatalog.getString("The Green Line");
        this.legendThePurpleLine = this.gettextCatalog.getString("The Purple Line");
        this.legendAmenities = this.gettextCatalog.getString("Amenities");
        this.legendBikeShop = this.gettextCatalog.getString("Bike Shop");
        this.legendFirstAid = this.gettextCatalog.getString("First Aid");
        this.legendRegionalTrails = this.gettextCatalog.getString("Regional Trails");
        this.legendJerusalemTrail = this.gettextCatalog.getString("Jerusalem Trail");
        this.legendSeaToSeaTrail = this.gettextCatalog.getString("Sea to Sea Trail");
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
        this.legendAreas = this.gettextCatalog.getString("Areas");
        this.legendCitySettelment = this.gettextCatalog.getString("City, Settelment");
        this.legendOrchard = this.gettextCatalog.getString("Orchard");
        this.legendCrop = this.gettextCatalog.getString("Crop");
        this.legendWoods = this.gettextCatalog.getString("Woods");
        this.legendGrass = this.gettextCatalog.getString("Grass");
        this.legendScrub = this.gettextCatalog.getString("Scrub");
        this.legendSand = this.gettextCatalog.getString("Sand");
        this.legendWetland = this.gettextCatalog.getString("Wetland");
        this.legendDryRiverbed = this.gettextCatalog.getString("Dry Riverbed");
        this.legendCemetary = this.gettextCatalog.getString("Cemetary");
        this.legendQuarry = this.gettextCatalog.getString("Quarry");
        this.legendConstructionSite = this.gettextCatalog.getString("Construction Site");
        this.legendEmpty = this.gettextCatalog.getString("No legend for this map...");

        this.currentLanguage = language;
        this.languageChanged.next(this.currentLanguage);
    }

    public translate(word: string): string {
        return this.gettextCatalog.getString(word) || word;
    }

    public hasRtlCharacters(words: string): boolean {
        return words.match(/^[^a-zA-Z]*[\u0591-\u05F4\u0600-\u06FF]/) != null;
    }

    public getDirection = (text?: string): Direction => {
        if (!text) {
            return this.direction;
        }
        return this.hasRtlCharacters(text) ? "rtl" : "ltr";
    }

    public getTextAlignment = (text?: string) => {
        return `text-${this.getDirection(text) === "rtl" ? "right" : "left"}`;
    }

    public getImageFloat = (text?: string) => {
        return this.getDirection(text) === "rtl" ? "left" : "right";
    }

    public getCurrentLanguageCodeSimplified = () => {
        return this.currentLanguage.code.split("-")[0];
    }

    public getResizedImageUrl(imageUrl: string, size: number) {
        if (!imageUrl) {
            return imageUrl;
        }
        if (imageUrl.includes("//upload.wikimedia.org/wikipedia/commons/")) {
            let url = imageUrl.replace(/(http.*\/\/upload\.wikimedia\.org\/wikipedia\/commons\/)(.*\/)(.*)/, `$1thumb/$2$3/${size}px-$3`);
            return url.endsWith(".svg") ? url + ".png" : url;
        }
        if (imageUrl.includes("//i.imgur.com/")) {
            let split = imageUrl.split(".");
            let extenstion = split.pop();
            let prefix = split.join(".");
            return prefix + this.getImgurPostfix(size) + "." + extenstion;
        }
        return imageUrl;
    }

    private getImgurPostfix(size: number) {
        if (size < 200) {
            return "t";
        }
        if (size < 400) {
            return "m";
        }
        if (size < 700) {
            return "l";
        }
        return "";
    }
}
