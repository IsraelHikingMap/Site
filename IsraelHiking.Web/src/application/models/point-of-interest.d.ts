import type { LatLngAlt } from "./models";
export type Contribution = {
    userName: string;
    userAddress: string;
    lastModifiedDate: Date;
};

export type SearchResultsPointOfInterest = {
    icon: string;
    iconColor: string;
    title: string;
    description: string;
    location: LatLngAlt;
    displayName: string;
    source: string;
    id: string;
};

export type EditablePublicPointData = {
    id: string;
    title: string;
    description: string;
    icon: string;
    iconColor: string;
    imagesUrls: string[];
    urls: string[];
    category: string;
    isPoint: boolean;
    canEditTitle: boolean;
    lengthInKm?: number;
};
