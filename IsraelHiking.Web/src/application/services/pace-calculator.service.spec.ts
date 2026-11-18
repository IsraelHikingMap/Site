import { describe, beforeEach, it, expect } from "vitest";
import { inject, TestBed } from "@angular/core/testing";

import { PaceCalculatorService } from "./pace-calculator.service";

function reportSpeeds(service: PaceCalculatorService, speed: number, count: number) {
    for (let index = 0; index < count; index++) {
        service.updatePace(speed);
    }
}

describe("PaceCalculatorService", () => {
    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [PaceCalculatorService]
        });
    });

    it("Should not give a remaining time before a speed was reported", inject([PaceCalculatorService],
        (service: PaceCalculatorService) => {
            service.updatePace(null);

            expect(service.getRemainingTimeInSeconds(1000)).toBeNull();
        }
    ));

    it("Should not give a remaining time when there is no distance left", inject([PaceCalculatorService],
        (service: PaceCalculatorService) => {
            service.updatePace(2);

            expect(service.getRemainingTimeInSeconds(0)).toBeNull();
        }
    ));

    it("Should average the speeds reported", inject([PaceCalculatorService],
        (service: PaceCalculatorService) => {
            service.updatePace(1);
            service.updatePace(3);

            expect(service.getRemainingTimeInSeconds(1000)).toBe(500);
        }
    ));

    it("Should hold the pace while resting", inject([PaceCalculatorService],
        (service: PaceCalculatorService) => {
            reportSpeeds(service, 1, 10);
            reportSpeeds(service, 0.2, 100);
            reportSpeeds(service, 0, 100);

            expect(service.getRemainingTimeInSeconds(1000)).toBe(1000);
        }
    ));

    it("Should follow the latest speeds only", inject([PaceCalculatorService],
        (service: PaceCalculatorService) => {
            reportSpeeds(service, 10, 100);
            reportSpeeds(service, 2, 10);

            expect(service.getRemainingTimeInSeconds(1000)).toBe(500);
        }
    ));

    it("Should forget the pace when cleared", inject([PaceCalculatorService],
        (service: PaceCalculatorService) => {
            service.updatePace(2);
            service.clear();

            expect(service.getRemainingTimeInSeconds(1000)).toBeNull();
        }
    ));
});
