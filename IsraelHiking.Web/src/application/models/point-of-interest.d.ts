import { DataContainer, LatLngAlt, NorthEast } from "./models";

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

export interface SearchResultsPointOfInterest {
    icon: string;
    iconColor: string;
    title: string;
    description: string;
    location: LatLngAlt,
    displayName: string;
    source: string;
    id: string;
}

export interface EditablePublicPointData {
    id: string;
    title: string;
    description: string;
    icon: string;
    iconColor: string;
    imagesUrls: string[];
    urls: string[];
    category: string;
    isPoint: boolean;
}