import { describe, beforeEach, it, expect, vi } from "vitest";
import { TestBed, inject } from "@angular/core/testing";

import { LogReaderService } from "./log-reader.service";
import { MapService } from "./map.service";

/** Lines as a log file holds them - newest first, see LoggingService.getLog. */
const GPS_LOG = [
    "2026-09-29 10:00:06 |  INFO | [Record] Stop recording",
    "2026-09-29 10:00:05 | DEBUG | [Record] Rejecting position, reason: Accuracy too low: 120 " +
        "{\"lat\":32.2,\"lng\":35.2,\"timestamp\":\"2026-09-29T07:00:05.000Z\"}",
    "2026-09-29 10:00:05 | DEBUG | [GeoLocation] Received position: lat: 32.2, lng: 35.2, " +
        "time: 2026-09-29T07:00:05.000Z, accuracy: 120, background: true",
    "2026-09-29 10:00:04 | DEBUG | [Record] Valid position, updating. " +
        "{\"lat\":32.1,\"lng\":35.1,\"timestamp\":\"2026-09-29T07:00:04.000Z\"}",
    "2026-09-29 10:00:04 | DEBUG | [GeoLocation] Received position: lat: 32.1, lng: 35.1, " +
        "time: 2026-09-29T07:00:04.000Z, accuracy: 10, background: false",
    "2026-09-29 10:00:00 |  INFO | [Record] Starting recording"
].join("\n");

describe("LogReaderService", () => {

    let addSource: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        addSource = vi.fn();
        const mapServiceMock = {
            addSource,
            addLayer: vi.fn(),
            fitBounds: vi.fn()
        };
        TestBed.configureTestingModule({
            providers: [
                { provide: MapService, useValue: mapServiceMock },
                LogReaderService
            ]
        });
    });

    it("Should draw the positions of the last recording in a gps log file",
        inject([LogReaderService], (service: LogReaderService) => {
            expect(service.readLogFile(GPS_LOG)).toBe(true);

            const points = addSource.mock.calls.find(c => c[0] === "log-points-geojson")[1].data;
            expect(points.features.length).toBe(2);
            expect(points.features[0].properties.color).toBe("#00FF00");
            // The position the recording rejected is marked in red
            expect(points.features[1].properties.color).toBe("#FF0000");
            const line = addSource.mock.calls.find(c => c[0] === "log-record-line-geojson")[1].data;
            expect(line.features[0].geometry.coordinates).toEqual([[35.1, 32.1]]);
        })
    );

    it("Should report that a log file with no positions has nothing to draw",
        inject([LogReaderService], (service: LogReaderService) => {
            expect(service.readLogFile("2026-09-29 10:00:00 |  INFO | [Main Menu] Unable to login")).toBe(false);

            expect(addSource).not.toHaveBeenCalled();
        })
    );
});
