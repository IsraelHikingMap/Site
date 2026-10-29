import { describe, beforeEach, it, expect, vi } from "vitest";
import { TestBed, inject } from "@angular/core/testing";

import { LogReaderService } from "./log-reader.service";
import { MapService } from "./map.service";

/** Lines as a log file holds them - newest first, see LoggingService.getLog. */
const GPS_LOG = [
    "2026-09-29 10:10:00 |  INFO | [Record] Stop recording",
    "2026-09-29 10:10:00 |  INFO | [Record] Valid position, updating. " +
        "{\"lat\":32.3,\"lng\":35.3,\"timestamp\":\"2026-09-29T07:00:06.000Z\",\"accuracy\":5}",
    "2026-09-29 10:10:00 |  INFO | [Record] Processing 1 positions",
    "2026-09-29 10:10:00 |  INFO | [Record] Recording was interrupted",
    "2026-09-29 10:00:05 |  INFO | [Record] Rejecting position, reason: Speed too high: 120 " +
        "{\"lat\":32.2,\"lng\":35.2,\"timestamp\":\"2026-09-29T07:00:05.000Z\",\"accuracy\":120}",
    "2026-09-29 10:00:05 |  INFO | [GeoLocation] Received position: lat: 32.2, lng: 35.2, " +
        "time: 2026-09-29T07:00:05.000Z, accuracy: 120, background: false",
    "2026-09-29 10:00:04 |  INFO | [Record] Valid position, updating. " +
        "{\"lat\":32.1,\"lng\":35.1,\"timestamp\":\"2026-09-29T07:00:04.000Z\",\"accuracy\":10}",
    "2026-09-29 10:00:04 |  INFO | [GeoLocation] Received position: lat: 32.1, lng: 35.1, " +
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
            expect(points.features.map((f: GeoJSON.Feature) => f.properties.color)).toEqual([
                "#00FF00",
                // Rejected by the recording
                "#FF0000",
                // Only known from the location log read after the app was killed, so taken in the background
                "#0000FF"
            ]);
            const accuracy = addSource.mock.calls.find(c => c[0] === "log-accuracy-geojson")[1].data;
            expect(accuracy.features.map((f: GeoJSON.Feature) => f.properties.radius)).toEqual([10, 120, 5]);
            const line = addSource.mock.calls.find(c => c[0] === "log-record-line-geojson")[1].data;
            expect(line.features[0].geometry.coordinates).toEqual([[35.1, 32.1], [35.3, 32.3]]);
        })
    );

    it("Should report that a log file with no positions has nothing to draw",
        inject([LogReaderService], (service: LogReaderService) => {
            expect(service.readLogFile("2026-09-29 10:00:00 |  INFO | [Main Menu] Unable to login")).toBe(false);

            expect(addSource).not.toHaveBeenCalled();
        })
    );
});
