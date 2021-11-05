export type LatLngAlt = {
    lat: number;
    lng: number;
    alt?: number;
};

export type LatLngAltTime = LatLngAlt & {
    timestamp: Date;
};
