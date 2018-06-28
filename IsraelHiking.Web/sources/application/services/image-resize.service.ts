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

    public resizeImageAndConvert(file: File): Promise<Common.DataContainer> {
        return new Promise((resolve, reject) => {
            let reader = new FileReader();
            reader.onload = (event: any) => {
                let exifData = this.piexif.load(event.target.result);
                let latLng = this.getGeoLocation(exifData);
                if (latLng == null) {
                    reject(new Error("Image does not contain geolocation information"));
                }
                let image = new Image();
                image.onload = () => {
                    let binaryStringData = this.resizeImage(image, exifData);
                    let data = this.createDataContainerFromBinaryString(file.name, latLng, binaryStringData);
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

    private resizeImage(image: HTMLImageElement, exifObj): string {
        let canvas = document.createElement("canvas");
        let maxSize = 1600; // in px for both height and width maximal size
        let width = image.naturalWidth;
        let height = image.naturalHeight;
        let ratio = maxSize / Math.max(width, height);
        if (ratio > 1) {
            let percentage = (width >= height)
                ? ((width - maxSize) / width * 100)
                : ((height - maxSize) / height * 100);
            canvas.width = (percentage + 100) / 100 * width;
            canvas.height = (percentage + 100) / 100 * height;
        } else {
            canvas.width = width * ratio;
            canvas.height = height * ratio;
        }
        canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
        let dataUrl = canvas.toDataURL(ImageResizeService.JPEG, 0.92);
        let exifbytes = this.piexif.dump(exifObj);
        dataUrl = this.piexif.insert(exifbytes, dataUrl);
        return dataUrl;
    }

    private createDataContainerFromBinaryString(name: string, latLng: L.LatLng, binaryStringData: string) {
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