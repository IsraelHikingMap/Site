module IsraelHiking.Common {
    export class Urls { 
        // api
        public static apiBase = "http://israelhiking.osm.org.il/";
        public static getShotUrl = Urls.apiBase + "s/";
        public static shortUrl = Urls.apiBase + "api/shorturl/";
        public static convertFiles = Urls.apiBase + "api/convertFiles";
        public static elevation = Urls.apiBase + "api/elevation";
        public static routing = Urls.apiBase + "api/routing";

    }
}