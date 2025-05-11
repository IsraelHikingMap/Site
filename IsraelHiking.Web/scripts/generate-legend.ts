import puppeteer from 'puppeteer';
import legendJson from '../src/content/legend/legend.json' with { type: 'json' };

/**
 * This script generates images for the legend items.
 * It loads the public styles from GitHub and creates images for each legend item.
 * It uses a headless browser to render the maps using MapLibre.
 * The images are saved in the src/content/legend folder.
 */


const browser = await puppeteer.launch({headless: false});

async function createImage(style: string, center: {lat: number, lng: number}, zoom: number, name: string, width = 50) {
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
        center: [${center.lng}, ${center.lat}],
        zoom: ${zoom - 1}, 
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
        await page.setViewport({
            width,
            height,
            deviceScaleFactor: 2
        });
        await page.setContent(html);
        // Wait for map to load, then wait for images, etc. to load.
        await page.waitForFunction('map.loaded()');
        await new Promise(resolve => setTimeout(resolve, 3000));
        const filename = `./src/content/legend/${style.split("/").pop().replace(".json","")}_${name}.png`;
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
    } catch (err) {
        console.log(err, name);
    }
    
    await page.close();
}
for (let style of ["https://raw.githubusercontent.com/IsraelHikingMap/VectorMap/master/Styles/IHM.json", 
    "https://raw.githubusercontent.com/IsraelHikingMap/VectorMap/master/Styles/ilMTB.json"]) {

    for (const legendSection of legendJson) {
        for (let legendItem of legendSection.items) {
            await createImage(style, legendItem.latlng, legendItem.zoom, legendItem.key, legendItem.type === "POI" ? 50 : 200);
        }
    }
}


await browser.close();
