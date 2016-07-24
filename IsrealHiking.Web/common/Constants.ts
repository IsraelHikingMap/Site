namespace IsraelHiking.Common {
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
        public static timeout = "$timeout";
        public static parserFactory = "parserFactory";
        public static searchResultsProviderFactory = "searchResultsProviderFactory";
        public static routerService = "routerService";
        public static routeLayerFactory = "routeLayerFactory";
        public static hashService = "hashService";
        public static mapService = "mapService";
        public static layersService = "layersService";
        public static localStorageService = "localStorageService";
        public static snappingService = "snappingService";
        public static fileService = "fileService";
        public static microsoftElevationProvider = "microsoftElevationProvider";
        public static elevationProvider = "elevationProvider";
        public static toastr = "toastr";
        public static upload = "Upload";
        public static fileSaver = "FileSaver";
        public static sidebarService = "sidebarService";
        
        // Controllers
        public static mainMapController = "mainMapController";
        public static fileController = "fileController";
        public static drawingController = "drawingController";
        public static editOSMController = "editOSMController";
        public static infoHelpController = "infoHelpController";
        public static markerPopupController = "markerPopupController";

        public static MARKERS = "markers";

        // make sure to update app.css if you update this list.
        public static COLORS = [
        { key: "blue", value: "#0000FF" },
        { key: "red", value: "#FF0000" },
        { key: "orange", value: "#FF6600" },
        { key: "pink", value: "#FF00DD" },
        { key: "green", value: "#008000" },
        { key: "purple", value: "#B700FF" },
        { key: "turquize", value: "#00B0A4" },
        { key: "gold", value: "#9C7F00" },
        { key: "brown", value: "#9C3E00" },
        { key: "grass", value: "#7F9900" },
        { key: "gray", value: "#7F8282" },
        { key: "dark", value: "#101010" }
        ];
    }

    export class GeoJsonFeatureType {
        public static featureCollection = "FeatureCollection";
        public static feature = "Feature";
        public static lineString = "LineString";
        public static multiLineString = "MultiLineString";
        public static polygone = "Polygon";
        public static multiPolygon = "MultiPolygon";
        public static point = "Point";
        public static multiPoint = "MultiPoint";
    }
} 