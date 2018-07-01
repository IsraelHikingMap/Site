import { Injectable } from "@angular/core";
import * as L from "leaflet";

import * as Common from "../common/IsraelHiking";
import { NonAngularObjectsFactory, IPiexif } from "./non-angular-objects.factory";

@Injectable()
export class ImageResizeService {
    public static readonly JPEG = "image/jpeg";

    private piexif: IPiexif;

    constructor(nonAngualrObjectsFactory: NonAngularObjectsFactory) {
        this.piexif = nonAngualrObjectsFactory.createPiexif();
    }

    public resizeImage(file: File): Promise<string> {
        return this.resizeImageAndConvertToAny<string>(file, data => data, false);
    }

    public resizeImageAndConvert(file: File, throwIfNoLocation = true): Promise<Common.DataContainer> {
        return this.resizeImageAndConvertToAny<Common.DataContainer>(file, this.createDataContainerFromBinaryString, throwIfNoLocation);
    }

    private resizeImageAndConvertToAny<TReturn>(file: File,
        convertMethod: (data: string, name: string, geoLocation: L.LatLng) => TReturn,
        throwIfNoLocation = true) {
        return new Promise<TReturn>((resolve, reject) => {
            let reader = new FileReader();
            reader.onload = (event: any) => {
                let exifData = this.piexif.load(event.target.result);
                let latLng = this.getGeoLocation(exifData);
                if (latLng == null && throwIfNoLocation) {
                    reject(new Error("Image does not contain geolocation information"));
                }
                let image = new Image();
                image.onload = () => {
                    let binaryStringData = this.orientAndResizeImage(image, exifData);
                    let data = convertMethod(binaryStringData, file.name, latLng);
                    resolve(data);
                };
                image.src = event.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    private getGeoLocation(exifData: any) {
        if (Object.keys(exifData.GPS).length === 0) {
            return null;
        }
        let lat = this.piexif.GPSHelper.dmsRationalToDeg(exifData.GPS[this.piexif.GPSIFD.GPSLatitude],
            exifData.GPS[this.piexif.GPSIFD.GPSLatitudeRef]);
        let lng = this.piexif.GPSHelper.dmsRationalToDeg(exifData.GPS[this.piexif.GPSIFD.GPSLongitude],
            exifData.GPS[this.piexif.GPSIFD.GPSLongitudeRef]);
        return L.latLng(lat, lng);
    }

    private orientAndResizeImage(image: HTMLImageElement, exifObj): string {
        let orientation = exifObj["0th"][this.piexif.ImageIFD.Orientation];
        exifObj["0th"][this.piexif.ImageIFD.Orientation] = 1;

        let canvas = document.createElement("canvas") as HTMLCanvasElement;
        let context = canvas.getContext("2d");

        let maxSize = 1600; // in px for both height and width maximal size
        let width = image.naturalWidth;
        let height = image.naturalHeight;
        let ratio = maxSize / Math.max(width, height);
        if (ratio < 1) {
            canvas.width = width * ratio;
            canvas.height = height * ratio;
        }
        let x = 0;
        let y = 0;
        width = canvas.width;
        height = canvas.height;
        if (orientation > 4) {
            canvas.width = height;
            canvas.height = width;
        }
        context.save();
        switch (orientation) {
        case 2:
            x = -canvas.width;
            context.scale(-1, 1);
            break;
        case 3:
            x = -canvas.width;
            y = -canvas.height;
            context.scale(-1, -1);
            break;
        case 4:
            y = -canvas.height;
            context.scale(1, -1);
            break;
        case 5:
            context.translate(canvas.width, canvas.height / canvas.width);
            context.rotate(Math.PI / 2);
            y = -canvas.width;
            context.scale(1, -1);
            break;
        case 6:
            context.translate(canvas.width, canvas.height / canvas.width);
            context.rotate(Math.PI / 2);
            break;
        case 7:
            context.translate(canvas.width, canvas.height / canvas.width);
            context.rotate(Math.PI / 2);
            x = -canvas.height;
            context.scale(-1, 1);
            break;
        case 8:
            context.translate(canvas.width, canvas.height / canvas.width);
            context.rotate(Math.PI / 2);
            x = -canvas.height;
            y = -canvas.width;
            context.scale(-1, -1);
            break;
        }
        context.drawImage(image, x, y, width, height);
        context.restore();

        let dataUrl = canvas.toDataURL(ImageResizeService.JPEG, 0.92);
        let exifbytes = this.piexif.dump(exifObj);
        dataUrl = this.piexif.insert(exifbytes, dataUrl);
        return dataUrl;
    }

    private createDataContainerFromBinaryString(binaryStringData: string, name: string, latLng: L.LatLng) {
        return {
            northEast: latLng,
            southWest: latLng,
            routes: [
                {
                    segments: [] as Common.RouteSegmentData[],
                    markers: [
                        {
                            title: name,
                            latlng: latLng,
                            urls: [
                                {
                                    mimeType: ImageResizeService.JPEG,
                                    url: binaryStringData
                                }
                            ]
                        }
                    ] as Common.MarkerData[]
                }
            ] as Common.RouteData[]
        } as Common.DataContainer;
    }
}