import { Injectable } from "@angular/core";
import Proj from "proj4";

import { LatLngAlt, NorthEast } from "../models";

const DECIMAL_DEGREES_REGEX_STRING = "([-+]?\\d{1,3}(?:\\.\\d+)?)°?";
const DELIMITER_REGEX_STRING = "(?:\\s*[,/\\s]\\s*)";
const INTEGER_NUMBER_STRING = "([+-]?\\d+)";
const DECIMAL_NUMBER_STRING = "(\\d+\\.?\\d+)";
const MINUTES_SYMBOLS_STRING = "\u0027\u00b4\u02b9\u02bc\u02ca\u201d\u2032\u275c";
const SECONDS_SYMBOL_STRING = "\u0022\u02ba\u201d\u2033\u275e\u3003\u301e";
const ANY_DEGREES_REGEX_STRING = "([\\d\\.°" + MINUTES_SYMBOLS_STRING + SECONDS_SYMBOL_STRING + ":\\s]+)";
const NORTH_SOUTH_REGEX_STRING = ANY_DEGREES_REGEX_STRING + "([NS])";
const EAST_WEST_REGEX_STRING = ANY_DEGREES_REGEX_STRING + "([EW])";

@Injectable()
export class CoordinatesService {
    static readonly ITM_WKT = "PROJCS[\"ITM\", GEOGCS[\"ITM\", DATUM[\"Isreal 1993\", SPHEROID[\"GRS 1980\", 6378137, 298.257222101, " +
        "AUTHORITY[\"EPSG\", \"7019\"]], TOWGS84[-24.0024, -17.1032, -17.8444, -0.33077, -1.85269, 1.66969, 5.4248]], " +
        "PRIMEM[\"Greenwich\", 0, AUTHORITY[\"EPSG\", \"8901\"]], UNIT[\"degree\", 0.017453292519943295, " +
        "AUTHORITY[\"EPSG\", \"9102\"]], AXIS[\"East\", EAST], AXIS[\"North\", NORTH]], UNIT[\"metre\", 1, " +
        "AUTHORITY[\"EPSG\", \"9001\"]], PROJECTION[\"Transverse_Mercator\"], " +
        "PARAMETER[\"latitude_of_origin\", 31.734393611111113], PARAMETER[\"central_meridian\", 35.20451694444444], " +
        "PARAMETER[\"false_northing\", 626907.39], PARAMETER[\"false_easting\", 219529.584], PARAMETER[\"scale_factor\", 1.0000067], " +
        "AXIS[\"East\", EAST], AXIS[\"North\", NORTH]]";


    static readonly DECIMAL_LAT_LON = new RegExp("^" +
        DECIMAL_DEGREES_REGEX_STRING + DELIMITER_REGEX_STRING + DECIMAL_DEGREES_REGEX_STRING + "$");
    static readonly DEGREES_MINUTES_SECONDS_LAT_LON = new RegExp("^" +
        NORTH_SOUTH_REGEX_STRING + DELIMITER_REGEX_STRING + EAST_WEST_REGEX_STRING + "$");
    static readonly REVERSE_DEGREES_MINUTES_SECONDS_LAT_LON = new RegExp("^" +
        EAST_WEST_REGEX_STRING+ DELIMITER_REGEX_STRING + NORTH_SOUTH_REGEX_STRING + "$");
    static readonly ITM_ICS_COORDINATES = new RegExp("^(\\d{6})" + DELIMITER_REGEX_STRING + "(\\d{6,7})$");
    static readonly SIX_NUMBERS_COORDINATES = new RegExp("^\\s*" + INTEGER_NUMBER_STRING + "[\\s°]\\s*" +
                                                            INTEGER_NUMBER_STRING + "[" + MINUTES_SYMBOLS_STRING + "\\s:]\\s*" +
                                                            DECIMAL_NUMBER_STRING + "[" + SECONDS_SYMBOL_STRING + "]?\\s*" +
                                                            DELIMITER_REGEX_STRING +
                                                            INTEGER_NUMBER_STRING + "[\\s°]\\s*" +
                                                            INTEGER_NUMBER_STRING + "[" + MINUTES_SYMBOLS_STRING + "\\s:]\\s*" +
                                                            DECIMAL_NUMBER_STRING + "[" + SECONDS_SYMBOL_STRING + "]?\\s*$");

    static readonly DECIMAL_DEGREES = new RegExp("^" + DECIMAL_DEGREES_REGEX_STRING + "$");
    static readonly DEGREES_MINUTES_SECONDS = new RegExp("^\\s*(\\d{1,3})(?:[:°\\s]\\s*)(\\d{1,2})(?:[:" +
                    MINUTES_SYMBOLS_STRING + "\\s]\\s*)(\\d{1,2}(?:\\.\\d+)?)[:" +
                    SECONDS_SYMBOL_STRING + "]?\\s*$");
    static readonly DEGREES_MINUTES = new RegExp("^\\s*(\\d{1,3})(?:[:°\\s]\\s*)(\\d{1,2}(?:\\.\\d+)?)[:" +
                    MINUTES_SYMBOLS_STRING + "]?\\s*$");

    private itmConverter = Proj(CoordinatesService.ITM_WKT);
    private coordinatesParserMap: {matcher: RegExp; parser: (match: RegExpMatchArray) => LatLngAlt}[];

    constructor() {
        this.coordinatesParserMap = [
            {
                matcher: CoordinatesService.ITM_ICS_COORDINATES,
                parser: (match) => this.parseItmIcsCoordinates(match)
            },
            {
                matcher: CoordinatesService.SIX_NUMBERS_COORDINATES,
                parser: (match) => this.parseSixNumbers(match)
            },
            {
                matcher: CoordinatesService.DEGREES_MINUTES_SECONDS_LAT_LON,
                parser: (match) => this.parseDegreesMinutesSeconds(match)
            },
            {
                matcher: CoordinatesService.REVERSE_DEGREES_MINUTES_SECONDS_LAT_LON,
                parser: (match) => this.parseReverseDegreesMinutesSeconds(match)
            },
            {
                matcher: CoordinatesService.DECIMAL_LAT_LON,
                parser: (match) => this.parseDecimalLatLng(match)
            }
        ];
    }

    public toItm(latLng: LatLngAlt): NorthEast {
        const coords = this.itmConverter.forward([latLng.lng, latLng.lat]);
        return {
            north: coords[1],
            east: coords[0]
        };
    }

    public fromItm(northEast: NorthEast): LatLngAlt {
        const coords = this.itmConverter.inverse([northEast.east, northEast.north]);
        return {
            lat: coords[1],
            lng: coords[0]
        };
    }

    public parseCoordinates(term: string): LatLngAlt {
        for (const item of this.coordinatesParserMap) {
            const matchArray = term.trim().match(item.matcher);
            if (matchArray && matchArray.length > 0) {
                return item.parser(matchArray);
            }
        }
        return null;
    }

    private parseItmIcsCoordinates(match: RegExpMatchArray): LatLngAlt {
        let east = parseInt(match[1], 10);
        let north = parseInt(match[2], 10);
        if (north >= 1350000)
        {
            return null;
        }
        if (north < 350000)
        {
            east = east + 50000;
            north = north + 500000;
        }
        else if (north > 850000)
        {
            east = east + 50000;
            north = north - 500000;
        }
        if (east >= 100000 && east <= 300000)
        {
            return this.fromItm({east, north});
        }
        return null;
    }

    private parseSixNumbers(match: RegExpMatchArray): LatLngAlt {
        const latitudeDegrees = parseFloat(match[1]);
        const latitudeMinutes = parseFloat(match[2]);
        const latitudeSeconds = parseFloat(match[3]);
        const longitudeDegrees = parseFloat(match[4]);
        const longitudeMinutes = parseFloat(match[5]);
        const longitudeSeconds = parseFloat(match[6]);

        return {
            lng: longitudeDegrees + longitudeMinutes / 60 + longitudeSeconds / 3600,
            lat: latitudeDegrees + latitudeMinutes / 60 + latitudeSeconds / 3600
        };
    }

    private parseReverseDegreesMinutesSeconds(match: RegExpMatchArray): LatLngAlt {
        return this.parseDegreesMinutesSeconds([match[0], match[3], match[4], match[1], match[2]]);
    }

    private parseDegreesMinutesSeconds(match: RegExpMatchArray): LatLngAlt {
        let lat = this.getDegreesFromString(match[1].trim());
        let lng = this.getDegreesFromString(match[3].trim());
        if (isNaN(lat) || isNaN(lng))
        {
            return null;
        }
        if (lat <= 90 && lng <= 180)
        {
            if (match[2] === "S")
            {
                lat = -lat;
            }
            if (match[4] === "W")
            {
                lng = -lng;
            }
            return {lng, lat};
        }
        return null;
    }

    private getDegreesFromString(degreesString: string): number {
        const decDegMatch = degreesString.match(CoordinatesService.DECIMAL_DEGREES);
        if (decDegMatch)
        {
            return parseFloat(decDegMatch[1]);
        }

        const degMinMatch = degreesString.match(CoordinatesService.DEGREES_MINUTES);
        if (degMinMatch)
        {
            const deg = parseFloat(degMinMatch[1]);
            const min = parseFloat(degMinMatch[2]);
            if (min < 60)
            {
                return min / 60.0 + deg;
            }
            return NaN;
        }

        const degMinSecMatch = degreesString.match(CoordinatesService.DEGREES_MINUTES_SECONDS);
        if (degMinSecMatch)
        {
            const deg = parseFloat(degMinSecMatch[1]);
            const min = parseFloat(degMinSecMatch[2]);
            const sec = parseFloat(degMinSecMatch[3]);
            if (min < 60 && sec < 60)
            {
                return (sec / 60.0 + min) / 60.0 + deg;
            }
        }
        return NaN;
    }

    private parseDecimalLatLng(match: RegExpMatchArray): LatLngAlt {
        const lat = parseFloat(match[1]);
        const lng = parseFloat(match[2]);
        if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180)
        {
            return {lng, lat};
        }
        return null;
    }
}
