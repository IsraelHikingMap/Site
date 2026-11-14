import { describe, beforeEach, it, expect, vi } from "vitest";
import { TestBed, inject } from "@angular/core/testing";
import * as piexifModule from "piexif-ts";
import type { IExif } from "piexif-ts";
import { decode } from "base64-arraybuffer";

import { ImageResizeService } from "./image-resize.service";

/**
 * Reproduces the app bundle, which hands piexif-ts exports back under `default` only - see ImageResizeService.importPiexif.
 * The exports sit on the prototype so that the test runner's interop can't copy them to the top level.
 */
vi.mock("piexif-ts", async (importOriginal) => Object.create(await importOriginal()));
const { dump, insert, TagValues } = (piexifModule as unknown as { default: typeof piexifModule }).default;

const IMAGE_BASE_64 =
    "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wCEAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAf/CABEIAAEAAQMBIgACEQEDEQH/xAAUAAEAAAAAAAAAAAAAAAAAAAAK/9oACAEBAAAAAH8f/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAhAAAAB//8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAxAAAAB//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPwB//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwB//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwB//9k=";

/**
 * The same image, with GPS data of 2 degrees south and 3 degrees east, in which GPSVersionID
 * and GPSAltitudeRef are written as a signed byte - a type piexif can't decode - the way a
 * Pixel 10 writes them. See https://github.com/IsraelHikingMap/Site/issues/2738
 */
const IMAGE_BASE_64_WITH_UNSUPPORTED_GPS_TAG_TYPE =
    "data:image/jpeg;base64,/9j/4QCwRXhpZgAATU0AKgAAAAgAAYglAAQAAAABAAAAGgAAAAAABwAAAAYAAAAEAgIAAAABAAIAAAACUwAAAAACAAUAAAADAAAAcAADAAIAAAACVwAAAAAEAAUAAAADAAAAiAAFAAYAAAABAAAAAAAGAAUAAAABAAAAoAAAAAIAAAABAAAAAAAAAAEAAAAAAAAAAQAAAAMAAAABAAAAAAAAAAEAAAAAAAAAAQAAAqwAAAAB/+AAEEpGSUYAAQEBAGAAYAAA/9sAhAABAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wgARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACv/aAAgBAQAAAAB/H//EABQBAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIQAAAAf//EABQBAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMQAAAAf//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAT8Af//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Af//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Af//Z";

function dataUrlToBlob(dataUrl: string): Blob {
    const base64Url = dataUrl.split(",")[1];
    const buffer = decode(base64Url);
    return new Blob([buffer], { type: "image/jpeg" });
}

describe("ImageResizeService", () => {
    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [],
            providers: [ImageResizeService]
        });
    });

    it("Should fail to convert the image without location data", inject([ImageResizeService], async (service: ImageResizeService) => {
        await expect(service.resizeImageAndConvert(new Blob([""]) as File)).rejects.toThrow();
    }));

    it("Should not fail when 0th is missing", inject([ImageResizeService], async (service: ImageResizeService) => {
        const exifData: IExif = {};
        const exifbytes = dump(exifData);
        const dataUrl = insert(exifbytes, IMAGE_BASE_64);
        const blob = dataUrlToBlob(dataUrl);
        await expect(service.resizeImage(blob as File)).resolves.not.toThrow();
    }));

    it("Should not fail when GPS values are empty", inject([ImageResizeService], async (service: ImageResizeService) => {
        const exifData: IExif = {
            GPS: {
                [TagValues.GPSIFD.GPSLatitude]: [[0, 1], [0, 1], [0, 1]],
                [TagValues.GPSIFD.GPSLongitude]: [[0, 1], [0, 1], [0, 1]],
                [TagValues.GPSIFD.GPSLatitudeRef]: "",
                [TagValues.GPSIFD.GPSLongitudeRef]: ""
            }
        };
        const exifbytes = dump(exifData);
        const dataUrl = insert(exifbytes, IMAGE_BASE_64);
        const blob = dataUrlToBlob(dataUrl);
        await expect(service.resizeImageAndConvert(blob as File)).rejects.toThrow("Image does not contain geolocation information");
    }));

    it("Should not fail when GPS values are bad", inject([ImageResizeService], async (service: ImageResizeService) => {
        const exifData: IExif = {
            GPS: {
                [TagValues.GPSIFD.GPSLatitude]: [[0, 0], [0, 1], [0, 1]],
                [TagValues.GPSIFD.GPSLongitude]: [[0, 0], [0, 1], [0, 1]],
                [TagValues.GPSIFD.GPSLatitudeRef]: "S",
                [TagValues.GPSIFD.GPSLongitudeRef]: "W"
            }
        };
        const exifbytes = dump(exifData);
        const dataUrl = insert(exifbytes, IMAGE_BASE_64);
        const blob = dataUrlToBlob(dataUrl);
        await expect(service.resizeImageAndConvert(blob as File)).rejects.toThrow("Image does not contain geolocation information");
    }));

    it("Should convert the image when the GPS data has tags with an unsupported type", inject([ImageResizeService],
        async (service: ImageResizeService) => {
            const blob = dataUrlToBlob(IMAGE_BASE_64_WITH_UNSUPPORTED_GPS_TAG_TYPE);
            const dataContainer = await service.resizeImageAndConvert(blob as File);
            expect(dataContainer.routes[0].markers[0].latlng.lat).toBe(-2);
            expect(dataContainer.routes[0].markers[0].latlng.lng).toBe(-3);
        }));

    it("Should convert the image with location data", inject([ImageResizeService], async (service: ImageResizeService) => {
        const exifData: IExif = {
            GPS: {
                [TagValues.GPSIFD.GPSLatitude]: [[2, 1], [0, 1], [0, 1]],
                [TagValues.GPSIFD.GPSLongitude]: [[3, 1], [0, 1], [0, 1]],
                [TagValues.GPSIFD.GPSLatitudeRef]: "S",
                [TagValues.GPSIFD.GPSLongitudeRef]: "W"
            }
        };
        const exifbytes = dump(exifData);
        const dataUrl = insert(exifbytes, IMAGE_BASE_64);
        const blob = dataUrlToBlob(dataUrl);
        const dataContainer = await service.resizeImageAndConvert(blob as File);
        expect(dataContainer.routes.length).toBe(1);
        expect(dataContainer.routes[0].markers.length).toBe(1);
        expect(dataContainer.routes[0].markers[0].latlng.lat).toBe(-2);
        expect(dataContainer.routes[0].markers[0].latlng.lng).toBe(-3);
    }));
});
