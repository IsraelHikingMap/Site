import { Injectable } from "@angular/core";
import { Http, Response } from "@angular/http";

import { AuthorizationService } from "./authorization.service";
import { FileService } from "./file.service";
import { ResourcesService } from "./resources.service";
import { Urls } from "../common/Urls";
import * as Common from "../common/IsraelHiking";

export type CategoriesType = "Points of Interest" | "Routes";

export interface IRater {
    id: string;
    value: number;
}

export interface IRating {
    id: string;
    source: string;
    raters: IRater[];
    total: number;
}

export interface IPointOfInterest {
    id: string;
    type: string;
    category: string;
    title: string;
    location: L.LatLng;
    source: string;
    icon: string;
    iconColor: string;
}

export interface IPointOfInterestExtended extends IPointOfInterest {
    isEditable: boolean;
    isRoute: boolean;
    imagesUrls: string[];
    description: string;
    url: string;
    sourceImageUrl: string;
    

    rating: IRating;
    dataContainer: Common.DataContainer;
}

export interface IIconColorLabel {
    icon: string;
    color: string;
    label: string;
}

export interface ICategory extends IIconColorLabel {
    key: string,
    isSelected: boolean;
}

@Injectable()
export class PoiService {
    private categoriesToIconsMap: Map<CategoriesType, {}>;

    constructor(private resources: ResourcesService,
        private http: Http,
        private authorizationService: AuthorizationService, 
        private fileService: FileService) {

        this.categoriesToIconsMap = new Map<CategoriesType, {}>();
        this.categoriesToIconsMap.set("Points of Interest", {});
        this.categoriesToIconsMap.set("Routes", {});
    }

    public getCategories(categoriesType: CategoriesType): Promise<{}> {
        return new Promise((resolve, reject) => {
            let categories = this.categoriesToIconsMap.get(categoriesType);
            if (Object.keys(categories).length > 0) {
                resolve(categories);
                return;
            }
            this.http.get(Urls.poiCategories + categoriesType).toPromise().then((response) => {
                let responseDictionary = response.json();
                for (let property in responseDictionary) {
                    if (responseDictionary.hasOwnProperty(property)) {
                        categories[property] = responseDictionary[property];
                    }
                }
                resolve(categories);
            }, (error) => {
                reject(error);
            });
        });
    }

    public getCategoriesTypes(): CategoriesType[] {
        return Array.from(this.categoriesToIconsMap.keys());
    }

    public getPoints(northEast: L.LatLng, southWest: L.LatLng, categoriesTypes: string[]): Promise<Response> {
        return this.http.get(Urls.poi,
            {
                params: {
                    northEast: northEast.lat + "," + northEast.lng,
                    southWest: southWest.lat + "," + southWest.lng,
                    categories: categoriesTypes.join(","),
                    language: this.resources.getCurrentLanguageCodeSimplified(),
                }
            }).toPromise();
    }

    public getPoint(id: string, source: string, type: string): Promise<Response> {
        return this.http.get(Urls.poi + source + "/" + id,
            {
                params: {
                     language: this.resources.getCurrentLanguageCodeSimplified(),
                     type: type
                }
            }).toPromise();
    }
    
    public uploadPoint(poiExtended: IPointOfInterestExtended, file: File): Promise<IPointOfInterestExtended> {
        let formData = new FormData();
        if (file) {
            formData.append("file", file, file.name);
        }
        formData.append("poiData", JSON.stringify(poiExtended));
        let uploadAddress = Urls.poi + "?language=" + this.resources.getCurrentLanguageCodeSimplified();
        return this.fileService.uploadWithData(uploadAddress, formData);
    }

    public uploadRating(rating: IRating): Promise<Response> {
        return this.http.post(Urls.rating, rating, this.authorizationService.getHeader()).toPromise();
    }
}