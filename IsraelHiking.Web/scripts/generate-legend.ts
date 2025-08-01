import puppeteer from 'puppeteer';
import legendJson from '../src/content/legend/legend.json' with { type: 'json' };
import type { Map } from 'maplibre-gl';

/**
 * This script generates images for the legend items.
 * It loads the public styles from GitHub and creates images for each legend item.
 * It uses a headless browser to render the maps using MapLibre.
 * The images are saved in the src/content/legend folder.
 */
const browser = await puppeteer.launch({headless: false});

// This is used in the evaluate function in puppeteer to access the map instance, the definition here is to allow TypeScript to recognize the type.
const map: Map = null;

async function createImages(style: string) {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset='utf-8'>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel='stylesheet' href='https://unpkg.com/maplibre-gl@latest/dist/maplibre-gl.css' />
    <script src='https://unpkg.com/maplibre-gl@latest/dist/maplibre-gl.js'></script>
    <style>
        body { margin: 0; padding: 0; }
        html, body, #map { height: 100%; }
    </style>
</head>
<body>
<div id="map"></div>
<script>
    maplibregl.setRTLTextPlugin(
        'https://unpkg.com/@mapbox/mapbox-gl-rtl-text@0.2.3/mapbox-gl-rtl-text.min.js',
        true // Lazy load the plugin
    );

    const map = new maplibregl.Map({
        container: 'map',
        style: '${style}',
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
    const page = await browser.newPage();
    try {
        for (const width of [50, 200]) {
            // This needs to happen before set content so that the map loading will respect the device scale factor.
            await page.setViewport({
                    width,
                    height,
                    deviceScaleFactor: 2
                });
            await page.setContent(html);
            await page.waitForFunction(() => map.loaded());
            for (const legendSection of legendJson) {
                for (let legendItem of legendSection.items) {
                    if (width === 50 && legendItem.type !== "POI") {
                        continue;
                    }
                    if (width === 200 && legendItem.type === "POI") {
                        continue;
                    }
                    await page.evaluate((lnglat, zoom) => {
                        map.setCenter(lnglat);
                        map.setZoom(zoom - 1);
                        return map.once('idle');
                    }, legendItem.latlng, legendItem.zoom);

                    const filename = `./src/content/legend/${style.split("/").pop().replace(".json","")}_${legendItem.key}.png`;
                    await page.screenshot({
                        path: filename,
                        type: 'png',
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
        }
    } catch (err) {
        console.log(err);
    }
    
    await page.close();
}
for (let style of ["https://raw.githubusercontent.com/IsraelHikingMap/VectorMap/master/Styles/IHM.json", 
    "https://raw.githubusercontent.com/IsraelHikingMap/VectorMap/master/Styles/ilMTB.json"]) {

    await createImages(style);
}


await browser.close();
