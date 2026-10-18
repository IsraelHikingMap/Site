import { inject, Service } from "@angular/core";
import { load, dump, insert, setErrorByPass, GPSHelper, TagValues, type IExif } from "piexif-ts";
import { encode } from "base64-arraybuffer";
import { v4 as uuidv4 } from "uuid";

import { LoggingService } from "./logging.service";
import type { LatLngAltTime, DataContainer, RouteSegmentData, MarkerData, RouteData } from "../models";

@Service()
export class ImageResizeService {
    public static readonly JPEG = "image/jpeg";

    private readonly loggingService = inject(LoggingService);

    /**
     * Resizes an image to a maximum size while preserving EXIF data.
     * @param file - The file to resize.
     * @param maxSize - The maximum size of the image.
     * @returns The resized image as a base64 string.
     */
    public resizeImage(file: File, maxSize = 1920): Promise<string> {
        return this.resizeImageAndConvertToAny<string>(file, data => data, false, maxSize);
    }

    public resizeImageAndConvert(file: File, throwIfNoLocation = true): Promise<DataContainer> {
        return this.resizeImageAndConvertToAny<DataContainer>(file, this.createDataContainerFromBinaryString, throwIfNoLocation);
    }

    private async resizeImageAndConvertToAny<TReturn>(file: File,
        convertMethod: (data: string, name: string, geoLocation: LatLngAltTime) => TReturn,
        throwIfNoLocation = true,
        maxSize = 1920): Promise<TReturn> {

        const arrayBuffer = await file.arrayBuffer();
        const base64 = "data:" + file.type + ";base64," + encode(arrayBuffer);
        let exifData: IExif = null;
        if (file.type === ImageResizeService.JPEG) {
            exifData = this.loadExifData(base64, file.name);
        }
        const latLng = this.getGeoLocation(exifData);
        if (latLng == null && throwIfNoLocation) {
            throw new Error("Image does not contain geolocation information");
        }
        const image = new Image();
        return new Promise<TReturn>((resolve, reject) => {
            image.onload = () => {
                const binaryStringData = this.resizeImageWithExif(image, exifData, maxSize);
                const data = convertMethod(binaryStringData, file.name, latLng);
                resolve(data);
            };
            image.onerror = () => {
                this.loggingService.error(`[Image] Failed to load the image ${file.name} of type ${file.type}`);
                reject(new Error("Failed to load image"));
            };
            image.src = base64;
        });
    }

    /**
     * Reads the EXIF data of an image, without failing over tags it can't decode.
     * Some cameras, the Pixel 10 for one, write GPSVersionID and GPSAltitudeRef as a signed byte,
     * a type piexif doesn't support, and a single such tag used to fail the entire read - and with
     * it the whole image - so these errors are bypassed to keep the rest of the data, the
     * geolocation included. The tags that failed come back as null and are dropped since "dump"
     * can't write them back.
     */
    private loadExifData(base64: string, name: string): IExif {
        try {
            setErrorByPass(true, (message: string) => this.loggingService.warning(
                `[Image] Ignoring an EXIF error in ${name}: ${message}`));
            const exifData = load(base64);
            for (const ifd of Object.values(exifData)) {
                if (ifd == null || typeof ifd !== "object") {
                    continue;
                }
                for (const [tag, value] of Object.entries(ifd)) {
                    if (value == null) {
                        delete ifd[Number(tag)];
                    }
                }
            }
            return exifData;
        } catch (ex) {
            this.loggingService.error(`[Image] Failed to read the EXIF data of ${name}: ${(ex as Error).message}`);
            return null;
        } finally {
            setErrorByPass(false);
        }
    }

    private getGeoLocation(exifData: IExif): LatLngAltTime {
        try {
            const lat = GPSHelper.dmsRationalToDeg(exifData.GPS[TagValues.GPSIFD.GPSLatitude],
                exifData.GPS[TagValues.GPSIFD.GPSLatitudeRef]);
            const lng = GPSHelper.dmsRationalToDeg(exifData.GPS[TagValues.GPSIFD.GPSLongitude],
                exifData.GPS[TagValues.GPSIFD.GPSLongitudeRef]);
            if (isNaN(lat) || isNaN(lng)) {
                return null;
            }
            return { lat, lng };
        } catch {
            return null;
        }
    }

    /**
     * Resizes an image to a maximum size while preserving EXIF data.
     * @param image - The HTML image to resize.
     * @param exifData - The EXIF data of the image.
     * @param maxSize - The maximum size of the image.
     * @returns The resized image as a base64 string.
     */
    private resizeImageWithExif(image: HTMLImageElement, exifData: IExif, maxSize: number): string {
        const canvas = document.createElement("canvas") as HTMLCanvasElement;

        const width = image.naturalWidth;
        const height = image.naturalHeight;
        let ratio = maxSize / Math.max(width, height);
        if (ratio > 1) {
            ratio = 1;
        }
        canvas.width = width * ratio;
        canvas.height = height * ratio;
        // There's no need to rotate the image since browsers do it automatically, only resize and change exif
        canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);

        let dataUrl = canvas.toDataURL(ImageResizeService.JPEG, 0.92);
        if (exifData != null && exifData["0th"] != null) {
            exifData["0th"][TagValues.ImageIFD.Orientation] = 1;
            const exifbytes = dump(exifData);
            dataUrl = insert(exifbytes, dataUrl);
        }
        return dataUrl;
    }

    private createDataContainerFromBinaryString(binaryStringData: string, name: string, latLng: LatLngAltTime) {
        return {
            northEast: latLng,
            southWest: latLng,
            routes: [
                {
                    segments: [] as RouteSegmentData[],
                    markers: [
                        {
                            id: uuidv4(),
                            title: name,
                            latlng: latLng,
                            type: "star",
                            urls: [
                                {
                                    mimeType: ImageResizeService.JPEG,
                                    url: binaryStringData
                                }
                            ]
                        }
                    ] as MarkerData[]
                }
            ] as RouteData[]
        } as DataContainer;
    }
}
