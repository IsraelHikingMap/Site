import { LinkData, LatLngAlt} from "./models";

export interface MarkerData {
    latlng: LatLngAlt;
    title: string;
    description: string;
    type: string;
    id?: string;
    urls: LinkData[];
}