namespace IsraelHiking.Services.Parsers {

    export class ParserType {
        public static geojson = "geojson";
        public static osm = "osm";
    }

    export class ParserFactory {
        public create(type: string): IParser {
            switch (type.toLocaleLowerCase()) {
                case ParserType.geojson:
                    return new GeoJsonParser();
                case ParserType.osm:
                    return new OsmParser();
                default:
                    return null;
            }
        }
    }
} 