import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { uniq, uniqWith } from "lodash";

import { ResourcesService } from "./resources.service";
import { HashService, IPoiRouterData } from "./hash.service";
import { WhatsAppService } from "./whatsapp.service";
import { DatabaseService } from "./database.service";
import { RunningContextService } from "./running-context.service";
import { SpatialService } from "./spatial.service";
import { GeoJsonParser } from "./geojson.parser";
import { Urls } from "../urls";
import { MarkerData, LatLngAlt, PointOfInterestExtended, PointOfInterest } from "../models/models";

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
    waze: string;
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
                private readonly databaseService: DatabaseService,
                private readonly runningContextService: RunningContextService,
                private readonly geoJsonParser: GeoJsonParser,
    ) {
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
                icons: category.items
                    .filter(i => i.iconColorCategory.icon !== "icon-nature-reserve")
                    .map(i => i.iconColorCategory)
            } as ISelectableCategory);
        }
        return selectableCategories;
    }

    public async getPoints(northEast: LatLngAlt, southWest: LatLngAlt, categoriesTypes: string[]): Promise<PointOfInterest[]> {
        let language = this.resources.getCurrentLanguageCodeSimplified();
        if (!this.runningContextService.isOnline) {
            let features = await this.databaseService.getPois(northEast, southWest, categoriesTypes, language);
            return features.map(f => this.featureToPoint(f)).filter(f => f != null);
        }

        let params = new HttpParams()
            .set("northEast", northEast.lat + "," + northEast.lng)
            .set("southWest", southWest.lat + "," + southWest.lng)
            .set("categories", categoriesTypes.join(","))
            .set("language", language);
        return this.httpClient.get(Urls.poi, { params }).toPromise() as Promise<PointOfInterest[]>;
    }

    public async getPoint(id: string, source: string, language?: string): Promise<PointOfInterestExtended> {
        let itemInCache = this.poiCache.find(p => p.id === id && p.source === source);
        if (itemInCache) {
            return { ...itemInCache };
        }
        if (!this.runningContextService.isOnline) {
            let feature = await this.databaseService.getPoiById(`${source}_${id}`);
            if (feature == null) {
                throw new Error("Failed to load POI from offline database.");
            }
            let point = this.featureToPoint(feature);
            return point;
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
            waze: `${Urls.waze}${poiExtended.location.lat},${poiExtended.location.lng}`
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

    private featureToPoint(f: GeoJSON.Feature): PointOfInterestExtended {
        let language = this.resources.getCurrentLanguageCodeSimplified();
        let imageUrls = uniq(Object.keys(f.properties).filter(k => k.toLowerCase().startsWith("image")).map(k => f.properties[k]));
        // HM TODO: remove this?
        // let references = Object.keys(f.properties).filter(k => k.toLowerCase().startsWith("website")).map(k => ({
        //     url: f.properties[k],
        //     sourceImageUrl: f.properties["poiSourceImageUrl" + k.replace("website", "")]
        // }));
        // references = uniqWith(references, (a, b) => a.url === b.url);
        let references = []; // no references due to offline.
        let description = f.properties["description:" + language] || f.properties.description;
        let poi = {
            id: f.properties.identifier,
            category: f.properties.poiCategory,
            hasExtraData: description != null || imageUrls.length > 0,
            icon: f.properties.poiIcon,
            iconColor: f.properties.poiIconColor,
            location: {
                lat: f.properties.poiGeolocation.lat,
                lng: f.properties.poiGeolocation.lon,
                alt: f.properties.poiAlt
            },
            itmCoordinates: {
                east: f.properties.poiItmEast,
                north: f.properties.poiItmNorth,
            },
            source: f.properties.poiSource,
            isEditable: f.properties.poiSource === "OSM",
            isRoute: f.geometry.type === "LineString" || f.geometry.type === "MultiLineString",
            isArea: f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon",
            lengthInKm: SpatialService.getLengthInMetersForGeometry(f.geometry) / 1000,
            dataContainer: null,
            featureCollection: {
                type: "FeatureCollection",
                features: [f]
            } as GeoJSON.FeatureCollection,
            references,
            contribution: {
                lastModifiedDate: new Date(f.properties["poiLastModified:" + language] || f.properties.poiLastModified),
                userAddress: f.properties["poiUserAddress:" + language] || f.properties.poiUserAddress,
                userName: f.properties["poiUserName:" + language] || f.properties.poiUserName
            },
            imagesUrls: imageUrls,
            description,
            title: Array.isArray(f.properties.poiNames[language]) && f.properties.poiNames[language].length !== 0
                ? f.properties.poiNames[language][0]
                : Array.isArray(f.properties.poiNames.all) && f.properties.poiNames.all.length !== 0
                    ? f.properties.poiNames.all[0]
                    : ""
        };
        if (!poi.title && !poi.hasExtraData) {
            return null;
        }
        return poi;
    }

    public async getClosestPoint(location: LatLngAlt, source?: string, language?: string): Promise<MarkerData> {
        if (!this.runningContextService.isOnline) {
            return null;
        }
        let params = new HttpParams()
            .set("location", location.lat + "," + location.lng)
            .set("source", source)
            .set("language", language);
        let feature = await this.httpClient.get(Urls.poiClosest, { params }).toPromise() as GeoJSON.Feature<GeoJSON.GeometryObject>;
        if (feature == null) {
            return null;
        }
        let dataContainer = this.geoJsonParser.toDataContainer({
            features: [feature],
            type: "FeatureCollection"
        }, this.resources.getCurrentLanguageCodeSimplified());
        let markerData = dataContainer.routes[0].markers[0];
        return markerData;
    }
}
