module IsraelHiking.Common {
    export class Urls { 
        // api
        public static apiBase = window.location.protocol + "//" + window.location.host + "/";
        public static getShotUrl = Urls.apiBase + "s/";
        public static shortUrl = Urls.apiBase + "api/shorturl/";
        public static convertFiles = Urls.apiBase + "api/convertFiles";
        public static elevation = Urls.apiBase + "api/elevation";
        public static routing = Urls.apiBase + "api/routing";

    }
}