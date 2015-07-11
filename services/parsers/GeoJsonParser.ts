module IsraelHiking.Services.Parsers {
    export class GeoJsonParser extends BaseParser implements IParser {
        public parse(content: string): Common.DataContainer {
            return super.toDataContainer(JSON.parse(content));
        }
        public toString(data: Common.DataContainer): string {
            var geoJson = super.toGeoJson(data);
            return JSON.stringify(geoJson);
        }
    }
} 