export interface LatLngAlt {
    lat: number;
    lng: number;
    alt?: number;
}

export interface ILatLngTime extends LatLngAlt {
    timestamp: Date;
}
