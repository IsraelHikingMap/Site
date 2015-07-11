module IsraelHiking.Services.Parsers {
    declare var tokml: Function;

    export class KmlParser extends XmlParser implements IParser {
        protected getFormat(): string {
            return "kml";
        }
        public convertToXml(geoJson: GeoJSON.FeatureCollection): string {
            return tokml(geoJson);
        }
    }
}  