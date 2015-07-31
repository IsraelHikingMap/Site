module IsraelHiking.Services.Parsers {

    export class ParserType {
        public static gpx = "gpx";
        public static kml = "kml";
        public static geojson = "geojson";
    }

    export class ParserFactory {
        public Create(type: string): IParser {
            switch (type.toLocaleLowerCase()) {
                case ParserType.gpx:
                    return new GpxParser();
                case ParserType.kml:
                    return new KmlParser();
                case ParserType.geojson:
                    return new GeoJsonParser();
                default:
                    return null;
            }
        }
    }
} 