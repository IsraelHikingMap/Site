import type { LatLngAlt } from ".";

export type SearchResultsPointOfInterest = {
    icon: string;
    iconColor: string;
    title: string;
    description: string;
    location: LatLngAlt;
    displayName: string;
    source: string;
    id: string;
    hasExtraData: boolean;
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
