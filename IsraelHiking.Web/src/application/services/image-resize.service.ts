import { Injectable } from "@angular/core";
import piexif, { type PiexifObject } from "piexifjs";

import type { LatLngAlt, DataContainer, RouteSegmentData, MarkerData, RouteData } from "../models/models";

@Injectable()
export class ImageResizeService {
    public static readonly JPEG = "image/jpeg";

    public resizeImage(file: File): Promise<string> {
        return this.resizeImageAndConvertToAny<string>(file, data => data, false);
    }

    public resizeImageAndConvert(file: File, throwIfNoLocation = true): Promise<DataContainer> {
        return this.resizeImageAndConvertToAny<DataContainer>(file, this.createDataContainerFromBinaryString, throwIfNoLocation);
    }

    private resizeImageAndConvertToAny<TReturn>(file: File,
                                                convertMethod: (data: string, name: string, geoLocation: LatLngAlt) => TReturn,
                                                throwIfNoLocation = true): Promise<TReturn> {
        return new Promise<TReturn>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event: any) => {
                let exifData: PiexifObject = null;
                if (file.type === ImageResizeService.JPEG) {
                    exifData = piexif.load(event.target.result);
                }
                const latLng = this.getGeoLocation(exifData);
                if (latLng == null && throwIfNoLocation) {
                    reject(new Error("Image does not contain geolocation information"));
                }
                const image = new Image();
                image.onload = () => {
                    const binaryStringData = this.resizeImageWithExif(image, exifData);
                    const data = convertMethod(binaryStringData, file.name, latLng);
                    resolve(data);
                };
                image.src = event.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    private getGeoLocation(exifData: PiexifObject): LatLngAlt {
        if (exifData == null || exifData.GPS == null ||
            Object.keys(exifData.GPS).length === 0 ||
            !Object.prototype.hasOwnProperty.call(exifData.GPS, piexif.GPSIFD.GPSLatitude) ||
            !Object.prototype.hasOwnProperty.call(exifData.GPS, piexif.GPSIFD.GPSLongitude)) {
            return null;
        }
        const lat = piexif.GPSHelper.dmsRationalToDeg(exifData.GPS[piexif.GPSIFD.GPSLatitude],
            exifData.GPS[piexif.GPSIFD.GPSLatitudeRef]);
        const lng = piexif.GPSHelper.dmsRationalToDeg(exifData.GPS[piexif.GPSIFD.GPSLongitude],
            exifData.GPS[piexif.GPSIFD.GPSLongitudeRef]);
        if (isNaN(lat) || isNaN(lng)) {
            return null;
        }
        return { lat, lng };
    }

    private resizeImageWithExif(image: HTMLImageElement, exifData: PiexifObject): string {
        const canvas = document.createElement("canvas") as HTMLCanvasElement;

        const maxSize = 1600; // in px for both height and width maximal size
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
        if (exifData != null) {
            exifData["0th"][piexif.ImageIFD.Orientation] = 1;
            const exifbytes = piexif.dump(exifData);
            dataUrl = piexif.insert(exifbytes, dataUrl);
        }
        return dataUrl;
    }

    private createDataContainerFromBinaryString(binaryStringData: string, name: string, latLng: LatLngAlt) {
        return {
            northEast: latLng,
            southWest: latLng,
            routes: [
                {
                    segments: [] as RouteSegmentData[],
                    markers: [
                        {
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
