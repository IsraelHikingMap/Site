module IsraelHiking.Services.Parsers {

    declare var toGeoJSON: Function[];
    
    export class XmlParser extends BaseParser implements IParser {
        public parse(content: string): Common.DataContainer {
            var document = (new DOMParser()).parseFromString(<string>content, "text/xml");
            var geojson = toGeoJSON[this.getFormat()](document);
            return super.toDataContainer(geojson);
        }

        public toString(data: Common.DataContainer): string {
            var geoJson = super.toGeoJson(data);
            return this.convertToXml(geoJson);
        }

        // should be implemented in derived class 
        protected getFormat(): string { return ""; }

        // should be implemented in derived class 
        protected convertToXml(geoJson: GeoJSON.FeatureCollection): string { return ""; }
    }
}   