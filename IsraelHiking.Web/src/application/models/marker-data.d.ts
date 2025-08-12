import type { LinkData, LatLngAlt } from ".";

export type MarkerData = {
    latlng: LatLngAlt;
    title: string;
    description: string;
    type: string;
    id?: string;
    urls: LinkData[];
};
