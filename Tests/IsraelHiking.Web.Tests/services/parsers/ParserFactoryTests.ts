/// <reference path="../../../../isrealhiking.web/services/parsers/parserfactory.ts" />

namespace IsraelHiking.Tests.Services.Parsers {
    describe("Parser Factory", () => {

        var parserFactory: IsraelHiking.Services.Parsers.ParserFactory;

        beforeEach(() => {
            parserFactory = new IsraelHiking.Services.Parsers.ParserFactory();
        });

        it("Should create geoJson Parser", () => {
            var parser = parserFactory.create(IsraelHiking.Services.Parsers.ParserType.geojson);

            expect(parser).toBeDefined();
        });

        it("Should create osm Parser", () => {
            var parser = parserFactory.create(IsraelHiking.Services.Parsers.ParserType.osm);

            expect(parser).toBeDefined();
        });

        it("Should return null otherwise", () => {
            var parser = parserFactory.create("something_else");

            expect(parser).toBeNull();
        });
    });
}