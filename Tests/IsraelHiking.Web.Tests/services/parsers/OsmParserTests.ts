/// <reference path="../../../../isrealhiking.web/services/parsers/osmparser.ts" />

namespace IsraelHiking.Tests {
    describe("Osm Parser", () => {

        var osmParser: Services.Parsers.OsmParser;
        var osmString = '<?xml version="1.0" encoding="UTF-8"?>\
                            <osm version="0.6" generator="Overpass API">\
                            <note>The data included in this document is from www.openstreetmap.org. The data is made available under ODbL.</note>\
                            <meta osm_base="2016-03-05T12:49:02Z"/>\
                              <node id="281408341" lat="30.2770275" lon="35.0209722">\
                                <tag k="highway" v="motorway_junction"/>\
                                <tag k="name" v="צומת ציחור"/>\
                                <tag k="name:en" v="Zihor"/>\
                                <tag k="name:he" v="צומת ציחור"/>\
                              </node>\
                              <node id="974851872" lat="30.2192891" lon="35.0133294"/>\
                              <way id="87172098">\
                                <nd ref="974851872"/>\
                                <nd ref="281408341"/>\
                                <tag k="highway" v="trunk"/>\
                                <tag k="maxspeed" v="90"/>\
                                <tag k="ref" v="40"/>\
                              </way>\
                            </osm>';

        beforeEach(() => {
            osmParser = new Services.Parsers.OsmParser();
        });

        it("Should parse osm string", () => {

            var data = osmParser.parse(osmString);

            expect(data.routes.length).toBe(1);
            expect(data.markers.length).toBe(1);
        });

        it("Should parse osm convert it geojson and back", () => {
            var data = {
                markers: [{ title: "title", latlng: L.latLng(1, 2) } as Common.MarkerData],
                routes: [
                    {
                        segments: []
                    }]
            } as Common.DataContainer;
            var osm = osmParser.toString(data);

            expect(osm).toContain('v="title"');
            expect(osm).toContain("node");
        });
    });
}