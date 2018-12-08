import { DataContainer, LatLngAlt } from "./models";

export interface Rater {
    id: string;
    value: number;
}

export interface Rating {
    id: string;
    source: string;
    raters: Rater[];
    total: number;
}

export interface PointOfInterest {
    id: string;
    category: string;
    title: string;
    source: string;
    icon: string;
    iconColor: string;
    hasExtraData: boolean;

    location: LatLngAlt;
}

export interface Reference {
    url: string;
    sourceImageUrl: string;
}

export interface Contribution {
    userName: string;
    userAddress: string;
    lastModifiedDate: Date;
}

export interface PointOfInterestExtended extends PointOfInterest {
    isEditable: boolean;
    isRoute: boolean;
    isArea: boolean;
    lengthInKm: number;
    imagesUrls: string[];
    description: string;
    references: Reference[];

    rating: Rating;
    dataContainer: DataContainer;
    featureCollection: GeoJSON.FeatureCollection;
    contribution: Contribution;
}