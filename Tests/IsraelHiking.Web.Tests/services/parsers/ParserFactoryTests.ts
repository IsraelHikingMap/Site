/// <reference path="../../../../isrealhiking.web/services/parsers/parserfactory.ts" />

namespace IsraelHiking.Tests {
    describe("Parser Factory", () => {

        var parserFactory: Services.Parsers.ParserFactory;

        beforeEach(() => {
            parserFactory = new Services.Parsers.ParserFactory();
        });

        it("Should create geoJson Parser", () => {
            var parser = parserFactory.create(Services.Parsers.ParserType.geojson);

            expect(parser).toBeDefined();
        });

        it("Should create osm Parser", () => {
            var parser = parserFactory.create(Services.Parsers.ParserType.osm);

            expect(parser).toBeDefined();
        });

        it("Should return null otherwise", () => {
            var parser = parserFactory.create("something_else");

            expect(parser).toBeNull();
        });
    });
}