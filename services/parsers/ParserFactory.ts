module IsraelHiking.Services.Parsers {

    export class ParserFactory {
        public Create(type: string): IParser {
            switch (type.toLocaleLowerCase()) {
                case "gpx":
                    return new GpxParser();
                case "kml":
                    return new KmlParser();
                case "geojson":
                    return new GeoJsonParser();
                default:
                    return null;
            }
        }
    }
} 