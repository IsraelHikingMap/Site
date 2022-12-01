import { inject, TestBed } from "@angular/core/testing";
import { decode } from "base64-arraybuffer";

import { GpxDataContainerConverterService } from "./gpx-data-container-converter.service";
import { RouteData } from "../models/models";

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
        let gpxBase64String = await service.toGpx({
            baseLayer: { address: "address", key: "key", maxZoom: 1, minZoom: 0, opacity: 1},
            northEast: { lat: 0, lng: 0 },
            southWest: { lat: 0, lng: 0},
            overlays: [],
            routes: [{id: "id", description: "", markers: [], name: "name", segments: [], state: "ReadOnly" }]
        });
        let dataContainer = await service.toDataContainer(await new Response(decode(gpxBase64String)).text());
        expect(dataContainer.routes.length).toBe(0);
    }));

    it("Should roundtrip datacontiner with one marker", inject([GpxDataContainerConverterService],
        async (service: GpxDataContainerConverterService) => {
        let gpxBase64String = await service.toGpx({
            baseLayer: { address: "address", key: "key", maxZoom: 1, minZoom: 0, opacity: 1},
            northEast: { lat: 0, lng: 0 },
            southWest: { lat: 0, lng: 0},
            overlays: [],
            routes: [{id: "id", description: "", markers: [
                {description: "desc", title: "title", type: "type", latlng: { lat: 1, lng: 2, alt: 3 }, urls: []}
            ], name: "name", segments: [], state: "ReadOnly" }]
        });
        let dataContainer = await service.toDataContainer(await new Response(decode(gpxBase64String)).text());
        expect(dataContainer.routes.length).toBe(1);
        expect(dataContainer.routes[0].markers.length).toBe(1);
        expect(dataContainer.routes[0].markers[0].description).toBe("desc");
        expect(dataContainer.routes[0].markers[0].title).toBe("title");
        expect(dataContainer.routes[0].markers[0].latlng.lat).toBe(1);
        expect(dataContainer.routes[0].markers[0].latlng.lng).toBe(2);
        expect(dataContainer.routes[0].markers[0].latlng.alt).toBe(3);
    }));

    it("Should roundtrip datacontiner with one route", inject([GpxDataContainerConverterService],
        async (service: GpxDataContainerConverterService) => {
        let gpxBase64String = await service.toGpx({
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
                    }],
                    state: "ReadOnly",
                    color: "color",
                    opacity: 1,
                    weight: 10
                }]
        });
        let dataContainer = await service.toDataContainer(await new Response(decode(gpxBase64String)).text());
        expect(dataContainer.routes.length).toBe(1);
        expect(dataContainer.routes[0].segments.length).toBe(1);
        expect(dataContainer.routes[0].segments[0].latlngs.length).toBe(2);
        expect(dataContainer.routes[0].segments[0].latlngs[0].lat).toBe(0);
        expect(dataContainer.routes[0].segments[0].latlngs[0].lng).toBe(0);
    }));

    it("Should roundtrip datacontiner with one route and split it - pretend the GPX was not create in IHM site",
        inject([GpxDataContainerConverterService], async (service: GpxDataContainerConverterService) => {
        let gpxBase64String = await service.toGpx({
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
        // as if this was a not create in IHM site
        let gpxString = (await new Response(decode(gpxBase64String)).text()).replace("IsraelHikingMap", "");
        let dataContainer = await service.toDataContainer(gpxString);
        expect(dataContainer.routes.length).toBe(1);
        expect(dataContainer.routes[0].segments.length).toBe(4);
        expect(dataContainer.routes[0].segments[0].latlngs.length).toBe(2);
        expect(dataContainer.routes[0].segments[0].latlngs[0].lat).toBe(0);
        expect(dataContainer.routes[0].segments[0].latlngs[0].lng).toBe(0);
        expect(dataContainer.routes[0].segments[3].latlngs.length).toBe(2);
        expect(dataContainer.routes[0].segments[3].latlngs[1].lat).toBe(9);
        expect(dataContainer.routes[0].segments[3].latlngs[1].lng).toBe(9);

    }));

    it("Should split a short route", () => {
        let latlngs = [
            {lat: 1, lng: 1, timestamp: new Date(1)},
            {lat: 2, lng: 2, timestamp: new Date(2)},
            {lat: 3, lng: 3, timestamp: new Date(3)}
        ];
        let segments = GpxDataContainerConverterService.getSegmentsFromLatlngs(latlngs, "Hike");
        expect(segments.length).toBe(2);
        expect(segments[0].latlngs.length).toBe(2);
        expect(segments[1].latlngs.length).toBe(3);
    });
});
