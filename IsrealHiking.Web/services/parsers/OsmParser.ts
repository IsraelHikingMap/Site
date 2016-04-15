declare module osm_geojson {
    var osm2geojson: Function;
    var geojson2osm: Function;
}

module IsraelHiking.Services.Parsers {

    export class OsmParser extends BaseParser implements IParser {
        protected parseToGeoJson(content: string): GeoJSON.FeatureCollection<GeoJSON.GeometryObject> {
            return osm_geojson.osm2geojson(content);
        }

        public toString(data: Common.DataContainer): string {
            var geoJson = super.toGeoJson(data);
            return this.convertToXml(geoJson);
        }

        // should be implemented in derived class 
        protected getFormat(): string { throw new Error("Should be implemented in derived class"); }

        // should be implemented in derived class 
        protected convertToXml(geoJson: GeoJSON.FeatureCollection<GeoJSON.GeometryObject>): string {
            return osm_geojson.geojson2osm(geoJson);
        }
    }
}  