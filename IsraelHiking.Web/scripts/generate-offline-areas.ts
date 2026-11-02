"use strict";

import fs from "fs";
import { bbox } from "@turf/bbox";
import { booleanPointInPolygon } from "@turf/boolean-point-in-polygon";
import { simplify } from "@turf/simplify";

/**
 * Generates offline-areas.json, the areas the offline management screen offers for download, which the
 * server hands to the client as they are. They are the regions of the Geofabrik index that are not split
 * any further, named in the languages of the app after the OSM boundary each of them stands for.
 * Run it again with "npm run generate-offline-areas" to pick up changes in either of them.
 */

type GeofabrikRegion = GeoJSON.Feature<GeoJSON.MultiPolygon, {
    id: string;
    parent?: string;
    name: string;
    "iso3166-1:alpha2"?: string[];
    "iso3166-2"?: string[];
}>;

type OsmRelation = {
    tags: Record<string, string>;
    bounds: { minlat: number; minlon: number; maxlat: number; maxlon: number };
};

const GEOFABRIK_INDEX_ADDRESS = "https://download.geofabrik.de/index-v1.json";
const OVERPASS_ADDRESS = "https://mapeak.com/api/interpreter";
const OUTPUT_FILE_PATH = "./offline-areas.json";
/** The languages of the app, see AVAILABLE_LANGUAGES, English is the name every other one falls back to */
const LANGUAGES = ["en", "he", "ar", "ru", "es", "de"];
/** About a kilometer, an area is picked on a map that shows whole countries and is never drawn up close */
const SIMPLIFY_TOLERANCE = 0.01;
const COORDINATE_DECIMALS = 3;
/** How many statements an Overpass query is sent with, the whole list at once takes it longer than its timeout */
const OVERPASS_BATCH_SIZE = 100;

const index = await (await fetch(GEOFABRIK_INDEX_ADDRESS)).json() as GeoJSON.FeatureCollection<GeoJSON.MultiPolygon>;
const regions = index.features as GeofabrikRegion[];
const parentIds = new Set(regions.map(region => region.properties.parent));
const leaves = regions.filter(region => !parentIds.has(region.properties.id));
const samplePoints = new Map(leaves.map(region => [region, getSamplePoints(region)]));
const areas = leaves.filter(region => !isGroupOfOtherAreas(region));
console.log(`Got ${regions.length} regions, ${leaves.length} are not split any further, of which these are groups of the others: ` +
    leaves.filter(region => !areas.includes(region)).map(region => region.properties.id).join(", "));

const relationsByIsoCode = await getRelationsByIsoCode(areas);
const getIsoRelations = (region: GeofabrikRegion) => getIsoCodes(region).map(code => relationsByIsoCode.get(code)).filter(relation => relation != null);
const relationsByName = await getRelationsByName(areas.filter(region => getIsoRelations(region).length === 0));
const features = areas.map(region => {
    const isoRelations = getIsoRelations(region);
    const relations = isoRelations.length > 0
        ? isoRelations
        : [findRelationByName(region, relationsByName)].filter(relation => relation != null);
    if (relations.length === 0) {
        console.log(`No OSM boundary for ${region.properties.id}, it is named "${getEnglishName(region.properties.name)}" in every language`);
    }
    return toArea(region, relations);
}).sort((a, b) => a.properties.id.localeCompare(b.properties.id));

fs.writeFileSync(OUTPUT_FILE_PATH, `{"type":"FeatureCollection","features":[\n${features.map(feature => JSON.stringify(feature)).join(",\n")}\n]}\n`);
console.log(`Wrote ${features.length} areas to ${OUTPUT_FILE_PATH}, ${Math.round(fs.statSync(OUTPUT_FILE_PATH).size / 1024)} KB`);

/**
 * Geofabrik also offers groups of regions that it splits otherwise, such as the Alps or the US West, which are
 * not split any further themselves. A region is such a group when the regions inside it cover most of it, which
 * keeps a region that only has a city of its own inside it, like Brandenburg with Berlin.
 */
function isGroupOfOtherAreas(region: GeofabrikRegion): boolean {
    const regionBounds = bbox(region);
    const regionsInside = leaves.filter(other => other !== region && isOverlapping(regionBounds, bbox(other)) && isInside(other, region));
    const covered = samplePoints.get(region).filter(point => regionsInside.some(other => booleanPointInPolygon(point, other)));
    return covered.length > samplePoints.get(region).length / 2;
}

/**
 * Whether most of a region is inside another one that is larger than it. Of two regions that cover the same
 * ground, like South Africa and South Africa with Lesotho, the one that is marked as a country or a subdivision
 * is the one that is inside the other, so that the other one is the group.
 */
function isInside(region: GeofabrikRegion, other: GeofabrikRegion): boolean {
    const shareInOther = getShareInside(samplePoints.get(region), other);
    const otherShareInRegion = getShareInside(samplePoints.get(other), region);
    if (shareInOther > 0.9 && otherShareInRegion > 0.9) {
        return getIsoCodes(region).length > 0 && getIsoCodes(other).length === 0;
    }
    return shareInOther > 0.5 && otherShareInRegion < shareInOther;
}

/** Points spread evenly over a region, as many as it takes for a thin or scattered region to have a few dozen */
function getSamplePoints(region: GeofabrikRegion): GeoJSON.Position[] {
    const [minLng, minLat, maxLng, maxLat] = bbox(region);
    let points: GeoJSON.Position[] = [];
    for (let gridSize = 10; points.length < 30 && gridSize <= 80; gridSize *= 2) {
        points = [];
        for (let x = 0.5; x < gridSize; x++) {
            for (let y = 0.5; y < gridSize; y++) {
                const point = [minLng + (maxLng - minLng) * x / gridSize, minLat + (maxLat - minLat) * y / gridSize];
                if (booleanPointInPolygon(point, region)) {
                    points.push(point);
                }
            }
        }
    }
    return points;
}

function getShareInside(points: GeoJSON.Position[], region: GeofabrikRegion): number {
    return points.filter(point => booleanPointInPolygon(point, region)).length / Math.max(points.length, 1);
}

function getIsoCodes(region: GeofabrikRegion): string[] {
    return region.properties["iso3166-2"] ?? region.properties["iso3166-1:alpha2"] ?? [];
}

/**
 * The OSM boundaries of the countries and the subdivisions the regions are marked with, of any kind since some
 * are disputed, where a code that is on more than one boundary, like a country and an overseas part of it,
 * stands for the one that is most like the region it is on.
 */
async function getRelationsByIsoCode(regions: GeofabrikRegion[]): Promise<Map<string, OsmRelation>> {
    const statements = regions.flatMap(region => [
        ...(region.properties["iso3166-2"] ?? []).map(code => `rel["ISO3166-2"="${code}"];`),
        ...(region.properties["iso3166-2"] == null ? region.properties["iso3166-1:alpha2"] ?? [] : [])
            .flatMap(code => [`rel["ISO3166-1:alpha2"="${code}"];`, `rel["ISO3166-1"="${code}"];`])
    ]);
    const relations = await queryOverpass(statements);
    const relationsByIsoCode = new Map<string, OsmRelation>();
    for (const region of regions) {
        for (const code of getIsoCodes(region)) {
            const candidates = relations.filter(relation => [relation.tags["ISO3166-2"], relation.tags["ISO3166-1:alpha2"], relation.tags["ISO3166-1"]].includes(code));
            const best = candidates.sort((a, b) => getBoundsOverlap(region, b) - getBoundsOverlap(region, a))[0];
            if (best != null) {
                relationsByIsoCode.set(code, best);
            }
        }
    }
    return relationsByIsoCode;
}

/** The OSM boundaries and places that are named like one of the regions, in its own language or in English */
async function getRelationsByName(regions: GeofabrikRegion[]): Promise<OsmRelation[]> {
    const statements = regions.flatMap(region => getCandidateNames(region.properties.name))
        .flatMap(name => [`rel["name"="${name}"];`, `rel["name:en"="${name}"];`]);
    const relations = await queryOverpass(statements);
    return relations.filter(relation => relation.tags.boundary != null || relation.tags.place != null);
}

/**
 * The largest boundary that is named like the region and is where it is. A boundary and the region it stands for
 * are never quite the same shape - a Geofabrik region reaches a few kilometers past its boundary and some take in
 * islands far away - so anything of that name around the region will do, and the largest is the region itself
 * rather than a city of the same name in it.
 */
function findRelationByName(region: GeofabrikRegion, relations: OsmRelation[]): OsmRelation | undefined {
    const names = getCandidateNames(region.properties.name);
    return relations
        .filter(relation => names.includes(relation.tags.name) || names.includes(relation.tags["name:en"]))
        .filter(relation => isOverlapping(toBBox(relation), bbox(region)))
        .sort((a, b) => getBoundsArea(toBBox(b)) - getBoundsArea(toBBox(a)))[0];
}

function toBBox(relation: OsmRelation): GeoJSON.BBox {
    return [relation.bounds.minlon, relation.bounds.minlat, relation.bounds.maxlon, relation.bounds.maxlat];
}

function getBoundsArea([minLng, minLat, maxLng, maxLat]: GeoJSON.BBox): number {
    return (maxLng - minLng) * (maxLat - minLat);
}

/**
 * The names a Geofabrik region could be named by in OSM: "Województwo opolskie<br />(Opole Voivodeship)" is
 * named in both languages and is "województwo opolskie" in OSM, "Brandenburg (mit Berlin)" says what it
 * includes besides the region itself, and "Hokkaidō" is "Hokkaido" in English.
 */
function getCandidateNames(name: string): string[] {
    const names = getNameParts(name);
    return [...new Set([...names, ...names.map(part => part.toLowerCase()), ...names.map(part => part.normalize("NFD").replace(/\p{Diacritic}/gu, ""))])];
}

/** The English name of a region, which is the second part of a name that is given in two languages */
function getEnglishName(name: string): string {
    return getNameParts(name).at(-1);
}

function getNameParts(name: string): string[] {
    return name.split("<br />").map(part => part.replace(/^\((.*)\)$/, "$1").replace(/\s*\((mit|with|includes|a\.k\.a\.) .*\)$/, "").trim());
}

async function queryOverpass(statements: string[]): Promise<OsmRelation[]> {
    const relations: OsmRelation[] = [];
    for (let start = 0; start < statements.length; start += OVERPASS_BATCH_SIZE) {
        const query = `[out:json][timeout:600];(${statements.slice(start, start + OVERPASS_BATCH_SIZE).join("")});out tags bb;`;
        const response = await fetch(OVERPASS_ADDRESS, { method: "POST", body: query });
        if (!response.ok) {
            throw new Error(`Overpass answered with ${response.status}: ${await response.text()}`);
        }
        relations.push(...(await response.json() as { elements: OsmRelation[] }).elements.filter(relation => relation.bounds != null));
        console.log(`Queried ${Math.min(start + OVERPASS_BATCH_SIZE, statements.length)} of ${statements.length} statements`);
    }
    return relations;
}

/** How much the boxes of a region and a boundary overlap, from 0 when they are apart to 1 when they are the same */
function getBoundsOverlap(region: GeofabrikRegion, relation: OsmRelation): number {
    const [minLng, minLat, maxLng, maxLat] = bbox(region);
    const { minlat, minlon, maxlat, maxlon } = relation.bounds;
    const intersection = Math.max(0, Math.min(maxLng, maxlon) - Math.max(minLng, minlon)) *
        Math.max(0, Math.min(maxLat, maxlat) - Math.max(minLat, minlat));
    const union = (maxLng - minLng) * (maxLat - minLat) + (maxlon - minlon) * (maxlat - minlat) - intersection;
    return intersection / union;
}

function isOverlapping(bounds: GeoJSON.BBox, otherBounds: GeoJSON.BBox): boolean {
    return bounds[0] < otherBounds[2] && otherBounds[0] < bounds[2] && bounds[1] < otherBounds[3] && otherBounds[1] < bounds[3];
}

/**
 * An area as the client gets it: its names in the languages of the app, where "name" is the English one, and
 * a region of a few countries is named after all of them, in the order the Geofabrik name lists them.
 * The id of a region that is a part of a country, like "us/texas", is made into one that can be a file name.
 */
function toArea(region: GeofabrikRegion, relations: OsmRelation[]): GeoJSON.Feature<GeoJSON.Geometry, Record<string, string>> {
    const englishName = getEnglishName(region.properties.name);
    const ordered = [...relations].sort((a, b) => getNamePosition(englishName, a) - getNamePosition(englishName, b));
    const properties: Record<string, string> = {
        id: region.properties.id.replace("/", "-"),
        name: ordered.length === 0 ? englishName : ordered.map(relation => relation.tags["name:en"] ?? relation.tags.name).join(" – ")
    };
    for (const language of LANGUAGES.filter(language => language !== "en")) {
        if (ordered.some(relation => relation.tags[`name:${language}`] != null)) {
            properties[`name:${language}`] = ordered.map(relation => relation.tags[`name:${language}`] ?? relation.tags["name:en"] ?? relation.tags.name).join(" – ");
        }
    }
    const geometry = simplify(region, { tolerance: SIMPLIFY_TOLERANCE, highQuality: true }).geometry;
    return { type: "Feature", properties, geometry: { ...geometry, coordinates: roundCoordinates(geometry.coordinates) } };
}

function getNamePosition(englishName: string, relation: OsmRelation): number {
    const position = englishName.indexOf(relation.tags["name:en"] ?? relation.tags.name);
    return position < 0 ? Number.MAX_SAFE_INTEGER : position;
}

function roundCoordinates(coordinates: GeoJSON.Position[][][]): GeoJSON.Position[][][] {
    const factor = Math.pow(10, COORDINATE_DECIMALS);
    return coordinates.map(polygon => polygon.map(ring => ring.map(([lng, lat]) => [Math.round(lng * factor) / factor, Math.round(lat * factor) / factor])));
}
