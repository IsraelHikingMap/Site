import { Injectable } from "@angular/core";
import { Http, Response } from "@angular/http";

import { AuthorizationService } from "./authorization.service";
import { Urls } from "../common/Urls";
import { ResourcesService } from "./resources.service";

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
    category: string;
    title: string;
    location: L.LatLng;
    source: string;
    icon: string;
    iconColor: string;
}

export interface IPointOfInterestExtended extends IPointOfInterest {
    imageUrl: string;
    description: string;
    rating: IRating;
    url: string;
    isEditable: boolean;
    featureCollection: GeoJSON.FeatureCollection<GeoJSON.GeometryObject>;
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
        private authorizationService: AuthorizationService) {

        this.categoriesToIconsMap = new Map<CategoriesType, {}>();
        this.categoriesToIconsMap.set("Points of Interest", {});
        this.categoriesToIconsMap.set("Routes", {});
    }

    public getCategoriesTypes(): CategoriesType[] {
        return Array.from(this.categoriesToIconsMap.keys());
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

    public getPoint(id: string, source: string): Promise<Response> {
        return this.http.get(Urls.poi + source + "/" + id,
            {
                params: { language: this.resources.getCurrentLanguageCodeSimplified() }
            }).toPromise();
    }

    public uploadPoint(poiExtended: IPointOfInterestExtended): Promise<Response> {
        let options = this.authorizationService.getHeader();
        options.params = {
            language: this.resources.getCurrentLanguageCodeSimplified()
        };
        return this.http.post(Urls.poi, poiExtended, options).toPromise();
    }

    public uploadRating(rating: IRating): Promise<Response> {
        return this.http.post(Urls.rating, rating, this.authorizationService.getHeader()).toPromise();
    }
}