import { describe, it, expect } from "vitest";

import { smoothHeading } from "./device-orientation.service";

describe("smoothHeading", () => {
    it("Should take the first reading as is", () => {
        expect(smoothHeading(null, 90)).toBe(90);
    });

    it("Should move part of the way towards a new reading", () => {
        expect(smoothHeading(0, 40)).toBe(10);
    });

    it("Should average readings on both sides of north to north", () => {
        expect(smoothHeading(350, 10)).toBe(355);
        expect(smoothHeading(10, 350)).toBe(5);
    });

    it("Should go around the shorter side when the reading is behind", () => {
        expect(smoothHeading(100, 60)).toBe(90);
    });
});
