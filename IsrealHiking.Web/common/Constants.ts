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
        public static window = "$window";
        public static parserFactory = "parserFactory";
        public static routerFactory = "routerFactory";
        public static drawingFactory = "drawingFactory";
        public static controlCreatorService = "controlCreatorService";
        public static hashService = "hashService";
        public static mapService = "mapService";
        public static layersService = "layersService";
        public static localStorageService = "localStorageService";
        public static snappingService = "snappingService";
        public static fileService = "fileService";
        public static microsoftElevationProvider = "microsoftElevationProvider";
        public static elevationProvider = "elevationProvider";
        
        // Controllers
        public static mainMapController = "mainMapController";
        public static fileController = "fileController";
        public static drawingController = "drawingController";
        public static editOSMController = "editOSMController";
        public static infoHelpController = "infoHelpController";
        public static markerPopupController = "markerPopupController";

        public static MARKERS = "markers";

        public static COLORS = [
            "#0000FF",
            "#FF0000",
            "#FF6600",
            "#FF00DD",
            "#008000",
            "#B700FF",
            "#00B0A4",
            "#9C7F00",
            "#9C3E00",
            "#7F9900",
            "#7F8282",
            "#101010"];
    }

} 