module IsraelHiking.Common {
    export class Urls { 
        // api
        public static apiBase = window.location.protocol + "//" + window.location.host + "/";
        public static urls = Urls.apiBase + "api/urls/";
        public static convertFiles = Urls.apiBase + "api/convertFiles";
        public static elevation = Urls.apiBase + "api/elevation";
        public static routing = Urls.apiBase + "api/routing";
        public static itmGrid = Urls.apiBase + "api/itmGrid";

    }
}