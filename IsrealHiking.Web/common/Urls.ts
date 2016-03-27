module IsraelHiking.Common {
    export class Urls { 
        // api
        public static apiBase = window.location.protocol + "//" + window.location.host + "/";
        public static urls = Urls.apiBase + "api/urls/";
        public static elevation = Urls.apiBase + "api/elevation";
        public static routing = Urls.apiBase + "api/routing";
        public static itmGrid = Urls.apiBase + "api/itmGrid";
        public static files = Urls.apiBase + "api/files";
        public static openFile = Urls.apiBase + "api/files/open";
        public static search = Urls.apiBase + "api/search/";
        public static overpass = window.location.protocol + "//overpass-api.de/api/interpreter";

    }
}