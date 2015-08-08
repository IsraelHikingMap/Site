module IsraelHiking.Common {
    export class Constants {
        // Services
        public static rootScope = "$rootScope";
        public static scope = "$scope";
        public static tooltip = "$tooltip";
        public static location = "$location";
        public static http = "$http";
        public static q = "$q";
        public static compile = "$compile";
        public static injector = "$injector";
        public static parserFactory = "parserFactory";
        public static routerFactory = "routerFactory";
        public static drawingFactory = "drawingFactory";
        public static controlCreatorService = "controlCreatorService";
        public static hashService = "hashService";
        public static mapService = "mapService";
        public static layersService = "layersService";
        public static localStorageService = "localStorageService";
        public static snappingService = "snappingService";
        
        // Controllers
        public static mainMapController = "mainMapController";
        public static fileController = "fileController";
        public static drawingController = "drawingController";
        public static editOSMController = "editOSMController";
        public static infoHelpController = "infoHelpController";
        public static markerPopupController = "markerPopupController";

        public static MARKERS = "markers";

        public static COLORS = ["blue", "red", "green", "pink",
            "purple", "brown", "yellow", "orange",
            "turquoise", "black", "grey", "white"];


    }

} 