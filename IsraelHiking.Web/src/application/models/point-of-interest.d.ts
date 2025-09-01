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

export type UpdateablePublicPointData = {
    title: string;
    description: string;
    icon: string;
    iconColor: string;
    imagesUrls: string[];
    urls: string[];
}

export type EditablePublicPointData = UpdateablePublicPointData & {
    id: string;
    category: string;
    isPoint: boolean;
    canEditTitle: boolean;
    showLocationUpdate: boolean;
    location: LatLngAlt;
    originalFeature: Immutable<GeoJSON.Feature>;
};
