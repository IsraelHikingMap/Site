import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import * as L from "leaflet";
import * as _ from "lodash";

import { ResourcesService } from "./resources.service";
import { HashService, IPoiRouterData } from "./hash.service";
import { WhatsAppService } from "./whatsapp.service";
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
    category: string;
    title: string;
    source: string;
    icon: string;
    iconColor: string;
    hasExtraData: boolean;

    location: L.LatLng;
}

export interface IReference {
    url: string;
    sourceImageUrl: string;
}

export interface IContribution {
    userName: string;
    userAddress: string;
    lastModifiedDate: Date;
}

export interface IPointOfInterestExtended extends IPointOfInterest {
    isEditable: boolean;
    isRoute: boolean;
    isArea: boolean;
    lengthInKm: number;
    imagesUrls: string[];
    description: string;
    references: IReference[];

    rating: IRating;
    dataContainer: Common.DataContainer;
    contribution: IContribution;
}

export interface IIconColorLabel {
    icon: string;
    color: string;
    label: string;
}

export interface ICategory {
    name: string;
    icon: string;
    color: string;
    isSelected: boolean;
    items: { iconColorCategory: IIconColorLabel, tags: any[] }[];
}

export interface IPoiSocialLinks {
    poiLink: string;
    facebook: string;
    whatsapp: string;
}

export interface ISelectableCategory extends ICategory {
    selectedIcon: IIconColorLabel;
    icons: IIconColorLabel[];
    label: string;
}

@Injectable()
export class PoiService {
    private categoriesMap: Map<CategoriesType, ICategory[]>;
    private poiCache: IPointOfInterestExtended[];
    private addOrUpdateMarkerData: Common.MarkerData;

    constructor(private readonly resources: ResourcesService,
        private readonly httpClient: HttpClient,
        private readonly whatsappService: WhatsAppService,
        private readonly hashService: HashService) {

        this.poiCache = [];
        this.addOrUpdateMarkerData = null;
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

    public getPoints(northEast: L.LatLng, southWest: L.LatLng, categoriesTypes: string[]): Promise<IPointOfInterest[]> {
        let params = new HttpParams()
            .set("northEast", northEast.lat + "," + northEast.lng)
            .set("southWest", southWest.lat + "," + southWest.lng)
            .set("categories", categoriesTypes.join(","))
            .set("language", this.resources.getCurrentLanguageCodeSimplified());
        return this.httpClient.get(Urls.poi, { params: params }).toPromise() as Promise<IPointOfInterest[]>;
    }

    public async getPoint(id: string, source: string, language?: string): Promise<IPointOfInterestExtended> {
        if (source === "new") {
            return this.mergeWithPoi({
                imagesUrls: [],
                source: "OSM",
                id: "",
                rating: { raters: [] },
                references: [],
                isEditable: true,
                dataContainer: { routes: [] }
            } as IPointOfInterestExtended);
        }
        let itemInCache = _.find(this.poiCache, p => p.id === id && p.source === source);
        if (itemInCache) {
            return this.mergeWithPoi(itemInCache);
        }
        let params = new HttpParams()
            .set("language", language || this.resources.getCurrentLanguageCodeSimplified());
        let poi = await this.httpClient.get(Urls.poi + source + "/" + id, { params: params }).toPromise() as IPointOfInterestExtended;
        this.poiCache.splice(0, 0, poi);
        return this.mergeWithPoi(poi);
    }

    public async uploadPoint(poiExtended: IPointOfInterestExtended): Promise<IPointOfInterestExtended> {
        let uploadAddress = Urls.poi + "?language=" + this.resources.getCurrentLanguageCodeSimplified();
        this.poiCache = [];
        return this.httpClient.post(uploadAddress, poiExtended).toPromise() as Promise<IPointOfInterestExtended>;
    }

    public uploadRating(rating: IRating): Promise<IRating> {
        return this.httpClient.post(Urls.rating, rating).toPromise() as Promise<IRating>;
    }

    public getPoiSocialLinks(poiExtended: IPointOfInterestExtended): IPoiSocialLinks {
        let poiLink = this.hashService.getFullUrlFromPoiId({
            source: poiExtended.source,
            id: poiExtended.id,
            language: this.resources.getCurrentLanguageCodeSimplified()
        } as IPoiRouterData);
        let escaped = encodeURIComponent(poiLink);
        return {
            poiLink: poiLink,
            facebook: `${Urls.facebook}${escaped}`,
            whatsapp: this.whatsappService.getUrl(poiExtended.title, escaped) as string,
        };
    }

    public setAddOrUpdateMarkerData(data: Common.MarkerData) {
        this.addOrUpdateMarkerData = data;
    }

    private mergeWithPoi(poiExtended: IPointOfInterestExtended) {
        if (this.addOrUpdateMarkerData == null) {
            return poiExtended;
        }
        poiExtended.title = poiExtended.title || this.addOrUpdateMarkerData.title;
        poiExtended.description = poiExtended.description || this.addOrUpdateMarkerData.description;
        poiExtended.location = poiExtended.location || this.addOrUpdateMarkerData.latlng;
        poiExtended.icon = poiExtended.icon || `icon-${this.addOrUpdateMarkerData.type}`;

        this.addOrUpdateMarkerData.urls.filter(u => u.mimeType.startsWith("image")).map(u => u.url).forEach(url => {
            poiExtended.imagesUrls.push(url);
        });
        this.addOrUpdateMarkerData = null;
        return poiExtended;
    }
}