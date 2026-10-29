import { describe, beforeEach, it, expect } from "vitest";
import { inject, TestBed } from "@angular/core/testing";

import { PaceCalculatorService } from "./pace-calculator.service";

/** A degree of longitude at the equator, which is what lets the tests walk in meters. */
const METERS_IN_A_LONGITUDE_DEGREE = 111319.49;

/** How often the gps reports a position while walking. */
const POSITION_INTERVAL_IN_SECONDS = 30;

type Walk = {
    /** The pace to walk at, in meters per second, zero to stand still. */
    speed: number;
    /** How long to keep walking for, in seconds. */
    duration: number;
};

/** Where along the equator the walk is, and at what time, so that a walk carries on from where the last one ended. */
type Walker = {
    meters: number;
    timestamp: number;
};

/** Walks on along the equator, feeding a position every {@link POSITION_INTERVAL_IN_SECONDS}. */
function walk(service: PaceCalculatorService, walker: Walker, { speed, duration }: Walk) {
    for (let elapsed = POSITION_INTERVAL_IN_SECONDS; elapsed <= duration; elapsed += POSITION_INTERVAL_IN_SECONDS) {
        walker.timestamp += POSITION_INTERVAL_IN_SECONDS * 1000;
        walker.meters += POSITION_INTERVAL_IN_SECONDS * speed;
        service.updatePace({ lat: 0, lng: walker.meters / METERS_IN_A_LONGITUDE_DEGREE }, walker.timestamp, null);
    }
}

function createWalker(): Walker {
    return { meters: 0, timestamp: new Date("2026-01-01T08:00:00Z").getTime() };
}

describe("PaceCalculatorService", () => {
    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [PaceCalculatorService]
        });
    });

    it("Should not give a remaining time before a pace was measured", inject([PaceCalculatorService],
        (service: PaceCalculatorService) => {
            service.updatePace({ lat: 0, lng: 0 }, Date.now(), null);

            expect(service.getRemainingTimeInSeconds(1000)).toBeNull();
            expect(service.getRemainingTimeInSeconds(0)).toBeNull();
        }
    ));

    it("Should use the speed the gps reported until the trail is long enough to measure a pace", inject([PaceCalculatorService],
        (service: PaceCalculatorService) => {
            const walker = createWalker();
            service.updatePace({ lat: 0, lng: 0 }, walker.timestamp, 2);

            expect(service.getRemainingTimeInSeconds(1000)).toBeCloseTo(500, -2);

            walk(service, walker, { speed: 1, duration: 300 });

            expect(service.getRemainingTimeInSeconds(1000)).toBeCloseTo(1000, -2);
        }
    ));

    it("Should follow the recent pace and forget the pace of an hour ago", inject([PaceCalculatorService],
        (service: PaceCalculatorService) => {
            const walker = createWalker();
            // ten minutes of driving to the trailhead
            walk(service, walker, { speed: 10, duration: 600 });
            const whileDriving = service.getRemainingTimeInSeconds(1000);
            // then twenty minutes of walking, which is longer than the pace window
            walk(service, walker, { speed: 1, duration: 1200 });

            expect(whileDriving).toBeCloseTo(100, -2);
            expect(service.getRemainingTimeInSeconds(1000)).toBeCloseTo(1000, -2);
        }
    ));

    it("Should hold the arrival time rather than lose it when the walk stops for a long rest", inject([PaceCalculatorService],
        (service: PaceCalculatorService) => {
            const walker = createWalker();
            walk(service, walker, { speed: 1, duration: 300 });
            const whileWalking = service.getRemainingTimeInSeconds(1000);
            // half an hour of standing still, which is longer than the pace window
            walk(service, walker, { speed: 0, duration: 1800 });
            const afterRest = service.getRemainingTimeInSeconds(1000);
            walk(service, walker, { speed: 0, duration: 600 });

            // the arrival time moves back while resting, and stops moving once the rest is all there is to measure
            expect(afterRest).toBeGreaterThan(whileWalking);
            expect(service.getRemainingTimeInSeconds(1000)).toBe(afterRest);
        }
    ));

    it("Should measure the pace again soon after a long rest", inject([PaceCalculatorService],
        (service: PaceCalculatorService) => {
            const walker = createWalker();
            walk(service, walker, { speed: 1, duration: 300 });
            walk(service, walker, { speed: 0, duration: 1800 });
            // three minutes of walking, which is longer than the pace window, leave the rest out of it
            walk(service, walker, { speed: 2, duration: 180 });

            expect(service.getRemainingTimeInSeconds(1000)).toBeCloseTo(500, -2);
        }
    ));

    it("Should forget the measured pace when cleared", inject([PaceCalculatorService],
        (service: PaceCalculatorService) => {
            walk(service, createWalker(), { speed: 1, duration: 300 });
            service.clear();

            expect(service.getRemainingTimeInSeconds(1000)).toBeNull();
        }
    ));
});
