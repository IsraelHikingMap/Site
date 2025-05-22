import { inject, TestBed } from "@angular/core/testing";
import { decode } from "base64-arraybuffer";

import { GpxDataContainerConverterService } from "./gpx-data-container-converter.service";

describe("GpxDataContainerConverterService", () => {
    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [],
            providers: [
                GpxDataContainerConverterService
            ]
        });
    });

    it("Should roundtrip empty datacontainer", inject([GpxDataContainerConverterService],
        async (service: GpxDataContainerConverterService) => {
        const gpxBase64String = await service.toGpx({
            baseLayer: { address: "address", key: "key", maxZoom: 1, minZoom: 0, opacity: 1},
            northEast: { lat: 0, lng: 0 },
            southWest: { lat: 0, lng: 0},
            overlays: [],
            routes: [{id: "id", description: "", markers: [], name: "name", segments: [], state: "ReadOnly" }]
        });
        const dataContainer = await service.toDataContainer(await new Response(decode(gpxBase64String)).text());
        expect(dataContainer.routes.length).toBe(0);
    }));

    it("Should roundtrip datacontiner with one marker", inject([GpxDataContainerConverterService],
        async (service: GpxDataContainerConverterService) => {
        const gpxBase64String = await service.toGpx({
            baseLayer: { address: "address", key: "key", maxZoom: 1, minZoom: 0, opacity: 1},
            northEast: { lat: 0, lng: 0 },
            southWest: { lat: 0, lng: 0},
            overlays: [],
            routes: [{
                id: "id", 
                description: "description",
                name: "name", 
                segments: [], state: "ReadOnly",
                markers: [{
                    description: "desc", 
                    title: "title", 
                    type: "type", 
                    latlng: { lat: 1, lng: 2, alt: 3 }, 
                    urls: [{url: "url", text: "text", mimeType: "image/jpeg"}]
                }]
            }]
        });
        const dataContainer = await service.toDataContainer(await new Response(decode(gpxBase64String)).text());
        expect(dataContainer.routes.length).toBe(1);
        expect(dataContainer.routes[0].markers.length).toBe(1);
        expect(dataContainer.routes[0].markers[0].description).toBe("desc");
        expect(dataContainer.routes[0].markers[0].title).toBe("title");
        expect(dataContainer.routes[0].markers[0].latlng.lat).toBe(1);
        expect(dataContainer.routes[0].markers[0].latlng.lng).toBe(2);
        expect(dataContainer.routes[0].markers[0].latlng.alt).toBe(3);
        expect(dataContainer.routes[0].markers[0].urls.length).toBe(1);
    }));

    it("Should roundtrip datacontiner with one route", inject([GpxDataContainerConverterService],
        async (service: GpxDataContainerConverterService) => {
        const gpxBase64String = await service.toGpx({
            baseLayer: { address: "address", key: "key", maxZoom: 1, minZoom: 0, opacity: 1},
            northEast: { lat: 0, lng: 0 },
            southWest: { lat: 0, lng: 0},
            overlays: [],
            routes: [
                {
                    id: "id",
                    description: "",
                    markers: [],
                    name: "name",
                    segments: [{
                        latlngs: [
                            {lat: 0, lng: 0, timestamp: new Date()},
                            {lat: 1, lng: 1, timestamp: new Date()}
                        ],
                        routePoint: { lat: 1, lng: 1},
                        routingType: "Hike"
                    },{
                        latlngs: [
                            {lat: 1, lng: 1, timestamp: new Date()},
                            {lat: 2, lng: 2, timestamp: new Date()}
                        ],
                        routePoint: { lat: 2, lng: 2},
                        routingType: "Hike"
                    },
                    {
                        latlngs: [
                            {lat: 2, lng: 2, timestamp: new Date()},
                            {lat: 3, lng: 3, timestamp: new Date()}
                        ],
                        routePoint: { lat: 3, lng: 3},
                        routingType: "Hike"
                    }
                    ],
                    state: "ReadOnly",
                    color: "color",
                    opacity: 1,
                    weight: 10
                }]
        });
        const dataContainer = await service.toDataContainer(await new Response(decode(gpxBase64String)).text());
        expect(dataContainer.routes.length).toBe(1);
        expect(dataContainer.routes[0].segments.length).toBe(3);
        expect(dataContainer.routes[0].segments[0].latlngs.length).toBe(2);
        expect(dataContainer.routes[0].segments[0].latlngs[0].lat).toBe(0);
        expect(dataContainer.routes[0].segments[0].latlngs[0].lng).toBe(0);
    }));

    it("Should roundtrip datacontiner with one route and split it - pretend the GPX was not create in this site",
        inject([GpxDataContainerConverterService], async (service: GpxDataContainerConverterService) => {
        const gpxBase64String = await service.toGpx({
            baseLayer: { address: "address", key: "key", maxZoom: 1, minZoom: 0, opacity: 1},
            northEast: { lat: 0, lng: 0 },
            southWest: { lat: 0, lng: 0},
            overlays: [],
            routes: [
                {
                    id: "id",
                    description: "",
                    markers: [],
                    name: "name",
                    segments: [{
                        latlngs: [
                            {lat: 0, lng: 0, timestamp: new Date()},
                            {lat: 1, lng: 1, timestamp: new Date()},
                            {lat: 2, lng: 2, timestamp: new Date()},
                            {lat: 3, lng: 3, timestamp: new Date()},
                            {lat: 4, lng: 4, timestamp: new Date()},
                            {lat: 5, lng: 5, timestamp: new Date()},
                            {lat: 6, lng: 6, timestamp: new Date()},
                            {lat: 7, lng: 7, timestamp: new Date()},
                            {lat: 8, lng: 8, timestamp: new Date()},
                            {lat: 9, lng: 9, timestamp: new Date()},
                        ],
                        routePoint: { lat: 9, lng: 9},
                        routingType: "Hike"
                    }],
                    state: "ReadOnly",
                    color: "color",
                    opacity: 1,
                    weight: 10
                }]
        });
        // as if this was a not create in this site
        const gpxString = (await new Response(decode(gpxBase64String)).text()).replace("IsraelHikingMap", "");
        const dataContainer = await service.toDataContainer(gpxString);
        expect(dataContainer.routes.length).toBe(1);
        expect(dataContainer.routes[0].segments.length).toBe(4);
        expect(dataContainer.routes[0].segments[0].latlngs.length).toBe(2);
        expect(dataContainer.routes[0].segments[0].latlngs[0].lat).toBe(0);
        expect(dataContainer.routes[0].segments[0].latlngs[0].lng).toBe(0);
        expect(dataContainer.routes[0].segments[3].latlngs.length).toBe(2);
        expect(dataContainer.routes[0].segments[3].latlngs[1].lat).toBe(9);
        expect(dataContainer.routes[0].segments[3].latlngs[1].lng).toBe(9);

    }));

    it("Should regect invalid GPX", inject([GpxDataContainerConverterService], async (service: GpxDataContainerConverterService) => {
        const gpxString = `<?xml version='1.0' encoding='UTF-8' standalone='no' ?>
            <gpx></gpi>`
            const promise = service.toDataContainer(gpxString);
            await expectAsync(promise).toBeRejected();
    }));

    it("Should convert GPX with rte", inject([GpxDataContainerConverterService], async (service: GpxDataContainerConverterService) => {
        const gpxString = `<?xml version='1.0' encoding='UTF-8' standalone='no' ?>
            <gpx xmlns='http://www.topografix.com/GPX/1/1' xmlns:xsi='http://www.w3.org/2001/XMLSchema-instance' xsi:schemaLocation='http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd' version='1.1'>
            <wpt lat='31.85073184447357' lon='34.964332580566406'>
                <name>title</name>
            </wpt>
            <rte>
                <rtept lat='31.841402444946397' lon='34.96433406040586'><ele>167</ele></rtept>
                <rtept lat='31.8414' lon='34.964336'><ele>167.5</ele></rtept>
                <rtept lat='31.84205' lon='34.965344'><ele>161</ele></rtept>
                <rtept lat='31.842161' lon='34.965611'><ele>161</ele></rtept>
                <rtept lat='31.842175' lon='34.965707'><ele>161</ele></rtept>
                <rtept lat='31.842176' lon='34.965708'></rtept>
            </rte>
            </gpx>`
        const datContainer = await service.toDataContainer(gpxString);
        expect(datContainer.routes.length).toBe(1);
        expect(datContainer.routes[0].segments.length).toBe(3);
        expect(datContainer.routes[0].segments[0].latlngs.length).toBe(2);
    }));

    it("Should split a short route", () => {
        const latlngs = [
            {lat: 1, lng: 1, timestamp: new Date(1)},
            {lat: 2, lng: 2, timestamp: new Date(2)},
            {lat: 3, lng: 3, timestamp: new Date(3)}
        ];
        const segments = GpxDataContainerConverterService.getSegmentsFromLatlngs(latlngs, "Hike");
        expect(segments.length).toBe(2);
        expect(segments[0].latlngs.length).toBe(2);
        expect(segments[1].latlngs.length).toBe(3);
    });
});
