import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";

import { ResourcesService } from "./resources.service";
import { HashService, IPoiRouterData } from "./hash.service";
import { WhatsAppService } from "./whatsapp.service";
import { Urls } from "../urls";
import { MarkerData, LatLngAlt, PointOfInterestExtended, PointOfInterest, Rating } from "../models/models";
import { DatabaseService } from "./database.service";

export type CategoriesType = "Points of Interest" | "Routes";

export interface IIconColorLabel {
    icon: string;
    color: string;
    label: string;
}

export interface ICategory {
    name: string;
    icon: string;
    color: string;
    visible: boolean;
    items: { iconColorCategory: IIconColorLabel, tags: any[] }[];
}

export interface IPoiSocialLinks {
    poiLink: string;
    facebook: string;
    whatsapp: string;
}

export interface ISelectableCategory extends ICategory {
    isSelected: boolean;
    selectedIcon: IIconColorLabel;
    icons: IIconColorLabel[];
    label: string;
}

@Injectable()
export class PoiService {
    private categoriesMap: Map<CategoriesType, ICategory[]>;
    private poiCache: PointOfInterestExtended[];

    constructor(private readonly resources: ResourcesService,
                private readonly httpClient: HttpClient,
                private readonly whatsappService: WhatsAppService,
                private readonly hashService: HashService,
                private readonly databaseService: DatabaseService) {

        this.poiCache = [];
        this.categoriesMap = new Map<CategoriesType, ICategory[]>();
        this.categoriesMap.set("Points of Interest", []);
        this.categoriesMap.set("Routes", []);

        this.resources.languageChanged.subscribe(() => {
            this.poiCache = [];
        });
    }

    public async getCategories(categoriesType: CategoriesType): Promise<ICategory[]> {
        let categories = this.categoriesMap.get(categoriesType);
        if (Object.keys(categories).length > 0) {
            return categories;
        }
        let categoriesArray = await this.httpClient.get(Urls.poiCategories + categoriesType).toPromise() as ICategory[];
        for (let category of categoriesArray) {
            categories.push(category);
        }
        return categories;
    }

    public getCategoriesTypes(): CategoriesType[] {
        return Array.from(this.categoriesMap.keys());
    }

    public getSelectableCategories = async (): Promise<ISelectableCategory[]> => {
        let categories = await this.getCategories("Points of Interest");
        let selectableCategories = [] as ISelectableCategory[];
        for (let category of categories) {
            if (category.name === "Wikipedia" || category.name === "iNature") {
                continue;
            }
            selectableCategories.push({
                name: category.name,
                isSelected: false,
                label: category.name,
                icon: category.icon,
                color: category.color,
                icons: category.items.map(i => i.iconColorCategory)
            } as ISelectableCategory);
        }
        return selectableCategories;
    }

    public getPoints(northEast: LatLngAlt, southWest: LatLngAlt, categoriesTypes: string[]): Promise<PointOfInterest[]> {
        // return this.databaseService.getPois(northEast, southWest, categoriesTypes);
        let params = new HttpParams()
           .set("northEast", northEast.lat + "," + northEast.lng)
           .set("southWest", southWest.lat + "," + southWest.lng)
           .set("categories", categoriesTypes.join(","))
           .set("language", this.resources.getCurrentLanguageCodeSimplified());
        return this.httpClient.get(Urls.poi, { params }).toPromise() as Promise<PointOfInterest[]>;
    }

    public async getPoint(id: string, source: string, language?: string): Promise<PointOfInterestExtended> {
        let itemInCache = this.poiCache.find(p => p.id === id && p.source === source);
        if (itemInCache) {
            return { ...itemInCache };
        }
        let params = new HttpParams()
            .set("language", language || this.resources.getCurrentLanguageCodeSimplified());
        let poi = await this.httpClient.get(Urls.poi + source + "/" + id, { params }).toPromise() as PointOfInterestExtended;
        this.poiCache.splice(0, 0, poi);
        return { ...poi };
    }

    public async uploadPoint(poiExtended: PointOfInterestExtended): Promise<PointOfInterestExtended> {
        let uploadAddress = Urls.poi + "?language=" + this.resources.getCurrentLanguageCodeSimplified();
        this.poiCache = [];
        return this.httpClient.post(uploadAddress, poiExtended).toPromise() as Promise<PointOfInterestExtended>;
    }

    public uploadRating(rating: Rating): Promise<Rating> {
        return this.httpClient.post(Urls.rating, rating).toPromise() as Promise<Rating>;
    }

    public getPoiSocialLinks(poiExtended: PointOfInterestExtended): IPoiSocialLinks {
        let poiLink = this.hashService.getFullUrlFromPoiId({
            source: poiExtended.source,
            id: poiExtended.id,
            language: this.resources.getCurrentLanguageCodeSimplified()
        } as IPoiRouterData);
        let escaped = encodeURIComponent(poiLink);
        return {
            poiLink,
            facebook: `${Urls.facebook}${escaped}`,
            whatsapp: this.whatsappService.getUrl(poiExtended.title, escaped) as string,
        };
    }

    public mergeWithPoi(poiExtended: PointOfInterestExtended, markerData: MarkerData) {
        poiExtended.title = poiExtended.title || markerData.title;
        poiExtended.description = poiExtended.description || markerData.description;
        poiExtended.location = poiExtended.location || markerData.latlng;
        poiExtended.icon = poiExtended.icon || `icon-${markerData.type || "star"}`;

        markerData.urls.filter(u => u.mimeType.startsWith("image")).map(u => u.url).forEach(url => {
            poiExtended.imagesUrls.push(url);
        });
        return poiExtended;
    }
}
