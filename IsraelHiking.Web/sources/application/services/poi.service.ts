import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import * as L from "leaflet";

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
        private httpClient: HttpClient) {

        this.categoriesToIconsMap = new Map<CategoriesType, {}>();
        this.categoriesToIconsMap.set("Points of Interest", {});
        this.categoriesToIconsMap.set("Routes", {});
    }

    public async getCategories(categoriesType: CategoriesType): Promise<{}> {
            let categories = this.categoriesToIconsMap.get(categoriesType);
            if (Object.keys(categories).length > 0) {
                return categories;
            }
        let responseDictionary = await this.httpClient.get(Urls.poiCategories + categoriesType).toPromise() as {};
        for (let property in responseDictionary) {
            if (responseDictionary.hasOwnProperty(property)) {
                categories[property] = responseDictionary[property];
            }
        }
        return categories;
    }

    public getCategoriesTypes(): CategoriesType[] {
        return Array.from(this.categoriesToIconsMap.keys());
    }

    public getPoints(northEast: L.LatLng, southWest: L.LatLng, categoriesTypes: string[]): Promise<IPointOfInterest[]> {
        let params = new HttpParams()
            .set("northEast", northEast.lat + "," + northEast.lng)
            .set("southWest", southWest.lat + "," + southWest.lng)
            .set("categories", categoriesTypes.join(","))
            .set("language", this.resources.getCurrentLanguageCodeSimplified());
        return this.httpClient.get(Urls.poi, { params: params }).toPromise() as Promise<IPointOfInterest[]>;
    }

    public getPoint(id: string, source: string, type: string): Promise<IPointOfInterestExtended> {
        let params = new HttpParams()
            .set("language", this.resources.getCurrentLanguageCodeSimplified())
            .set("type", type);
        return this.httpClient.get(Urls.poi + source + "/" + id, { params: params }).toPromise() as Promise<IPointOfInterestExtended>;
    }
    
    public uploadPoint(poiExtended: IPointOfInterestExtended, files: File[]): Promise<IPointOfInterestExtended> {
        let formData = new FormData();
        for (let file of files) {
            formData.append("files", file, file.name);
        }
        formData.append("poiData", JSON.stringify(poiExtended));
        let uploadAddress = Urls.poi + "?language=" + this.resources.getCurrentLanguageCodeSimplified();
        return this.httpClient.post(uploadAddress, formData).toPromise() as Promise<IPointOfInterestExtended>;
    }

    public uploadRating(rating: IRating): Promise<IRating> {
        return this.httpClient.post(Urls.rating, rating).toPromise() as Promise<IRating>;
    }
}