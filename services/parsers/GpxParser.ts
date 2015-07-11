module IsraelHiking.Services.Parsers {

    declare var togpx: Function;

    export class GpxParser extends XmlParser implements IParser {
        protected getFormat(): string {
            return "gpx";
        }
        public convertToXml(geoJson: GeoJSON.FeatureCollection): string {
            return togpx(geoJson);
        }
    }
} 