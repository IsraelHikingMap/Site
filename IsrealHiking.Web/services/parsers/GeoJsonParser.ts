namespace IsraelHiking.Services.Parsers {
    export class GeoJsonParser extends BaseParser implements IParser {

        protected parseToGeoJson(content: string): GeoJSON.FeatureCollection<GeoJSON.GeometryObject> {
            return JSON.parse(content);
        }

        public toString(data: Common.DataContainer): string {
            var geoJson = super.toGeoJson(data);
            return JSON.stringify(geoJson);
        }
    }
} 