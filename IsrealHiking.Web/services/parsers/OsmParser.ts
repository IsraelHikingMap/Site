module IsraelHiking.Services.Parsers {

    export class OsmParser extends XmlParser implements IParser {
        protected getFormat(): string {
            return "osm";
        }
        public convertToXml(geoJson: GeoJSON.FeatureCollection): string {
            throw new Error("not impelemented...");
        }
    }
}  