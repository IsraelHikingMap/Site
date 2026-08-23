import puppeteer from "puppeteer";
import http from "http";
import legendJson from "../src/content/legend/legend.json" with { type: "json" };
import projectPackage from "../package.json" with { type: "json" };
import {argv} from "process";
import type { AddressInfo } from "net";
import type { Map } from "maplibre-gl";

/**
 * This script generates images for the legend items.
 * It loads the public styles from GitHub and creates images for each legend item.
 * It uses the browser to render the maps using MapLibre.
 * The images are saved in the src/content/legend folder.
 * You can run a single image generation by providing the legend key as part of the cmd args.
 */
const browser = await puppeteer.launch({headless: false});
const specificImage = argv?.[2];
if (specificImage) {
    console.log("Running legend generation only for '" + specificImage + "' key.");
}
// This is used in the evaluate function in puppeteer to access the map instance, the definition here is to allow TypeScript to recognize the type.
const map: Map = null;

// Both libraries are loaded from a CDN, so keep the versions in sync with the ones this project depends on.
const maplibreVersion = projectPackage.dependencies["maplibre-gl"];
const rtlTextVersion = projectPackage.dependencies["@mapbox/mapbox-gl-rtl-text"];

// MapLibre v6 is ESM only and starts its worker from a same-origin blob URL, which the browser refuses on the
// opaque origin that page.setContent() creates. Serving the page over http gives it a real origin instead.
let pageHtml = "";
const server = http.createServer((_, response) => {
    response.writeHead(200, { "Content-Type": "text/html" });
    response.end(pageHtml);
}).listen(0);
const pageUrl = `http://localhost:${(server.address() as AddressInfo).port}/`;

async function createImages(style: string, type: string) {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset='utf-8'>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel='stylesheet' href='https://unpkg.com/maplibre-gl@${maplibreVersion}/dist/maplibre-gl.css' />
    <style>
        body { margin: 0; padding: 0; }
        html, body, #map { height: 100%; }
    </style>
</head>
<body>
<div id="map"></div>
<script type="module">
    import * as maplibregl from 'https://unpkg.com/maplibre-gl@${maplibreVersion}/dist/maplibre-gl.mjs';

    maplibregl.setRTLTextPlugin(
        'https://unpkg.com/@mapbox/mapbox-gl-rtl-text@${rtlTextVersion}/dist/mapbox-gl-rtl-text.js',
        true // Lazy load the plugin
    );

    // A module script has its own scope, so the map is put on window for page.evaluate to reach it.
    window.map = new maplibregl.Map({
        container: 'map',
        style: ${JSON.stringify(style)},
        center: [0, 0],
        zoom: 1, 
        maplibreLogo: false,
        attributionControl: false,
        preserveDrawingBuffer: true
    });
</script>
</body>
</html>
`;
    const height = 50
    
    try {
        for (const width of [50, 200]) {
            const page = await browser.newPage();
            // This needs to happen before the page is loaded so that the map loading will respect the device scale factor.
            await page.setViewport({
                width,
                height,
                deviceScaleFactor: 2
            });
            pageHtml = html;
            await page.goto(pageUrl);
            await page.waitForFunction(() => map.loaded());
            for (const legendSection of legendJson) {
                for (const legendItem of legendSection.items) {
                    if (specificImage && legendItem.key !== specificImage) {
                        continue;
                    }
                    if (width === 50 && legendItem.type !== "POI") {
                        continue;
                    }
                    if (width === 200 && legendItem.type === "POI") {
                        continue;
                    }
                    await page.evaluate((lnglat, zoom) => {
                        map.setCenter(lnglat);
                        map.setZoom(zoom - 1);
                        return map.once("idle");
                    }, legendItem.latlng, legendItem.zoom);

                    const filename = `./src/content/legend/${type}_${legendItem.key}.png`;
                    await page.screenshot({
                        path: filename,
                        type: "png",
                        clip: {
                            x: 0,
                            y: 0,
                            width,
                            height
                        }
                    })
                    console.log(`Created ${filename}`);
                }
            }
            await page.close();
        }
    } catch (err) {
        console.log(err);
    }
}
for (const style of ["https://raw.githubusercontent.com/IsraelHikingMap/VectorMap/master/Styles/mapeak-hike.json", 
    "https://raw.githubusercontent.com/IsraelHikingMap/VectorMap/master/Styles/mapeak-bike.json"]) {

    const response = await fetch(style);
    const text = await response.text();
    const jsonStyle = JSON.parse(text.replace(/name:he/g, "name:en"));

    await createImages(jsonStyle, style.split("/").pop().split("-").pop().split(".")[0]);
}


await browser.close();
server.close();
