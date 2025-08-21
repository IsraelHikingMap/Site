// This script gewnerrates sprites by calling spreet docker image.
// It also adds a halo to the icons.
// It ignores halo for icons that has a pattern in their file name.
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const iconsDir = './scripts/SVGs';
const inputDir = './scripts/input';
if (fs.existsSync(inputDir)) {
    fs.rmSync(inputDir, { recursive: true, force: true });
}
fs.mkdirSync(inputDir, { recursive: true });

const publishDir = './src/content/sprite';
const dockerImage = 'ghcr.io/flother/spreet:0.12.1';
let haloIcons = fs.readdirSync(iconsDir)
  .filter(file => file.endsWith('.svg') && !file.includes('pattern') && !file.includes('arrowline') && !file.includes('triangle') && !file.includes('square'));

haloIcons = haloIcons.concat(['cross_pattern.svg', 'plus_pattern.svg']);
// read svg and add a halo
for (let file of haloIcons) {
    let svgContent = fs.readFileSync(path.join(iconsDir, file), 'utf8');
    svgContent = svgContent.replace('<path ', '<path style="stroke:white;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:none;paint-order:stroke fill markers" ');
    // add 2 pixels to the width and height, and move the viewBox by 1 pixel in each direction
    svgContent = svgContent.replace(/viewBox="(\d+) (\d+) (\d+(\.\d+)?) (\d+(\.\d+)?)"/, (_match, x, y, width, _widthDec, height) => {
        return `viewBox="${+x} ${+y} ${+width+2} ${+height+2}"`;
    });
    // change traslate by 1 pixel in each direction
    svgContent = svgContent.replace(/translate\((-?\d+(\.\d+)?) (-?\d+(\.\d+)?)\)/g, (_match, x, _decimal, y) => {
        return `translate(${+x+1} ${+y+1})`;
    });
    svgContent = svgContent.replace(/width="(\d+(\.\d+)?)"/, (_match, width) => {
        return `width="${+width+8}"`;
    });
    svgContent = svgContent.replace(/height="(\d+(\.\d+)?)"/, (_match, height) => {
        return `height="${+height+8}"`;
    });
    fs.writeFileSync(path.join(inputDir, file), svgContent);
}

function copyIconWithDifferentColor(originalFile: string, newFile: string, color: string) {
    let svgContent = fs.readFileSync(path.join(inputDir, originalFile), 'utf8');
    if (svgContent.includes('<path fill="')) {
        svgContent = svgContent.replace(/path fill="[^"]*"/, `path fill="${color}"`);
    } else {
        svgContent = svgContent.replace('<path ', `<path fill="${color}" `);
    }
    fs.writeFileSync(path.join(inputDir, newFile), svgContent);
}

// Handle duplicate icons with different colors
copyIconWithDifferentColor('synagogue.svg', 'first_aid.svg', 'red');
copyIconWithDifferentColor('gate_open.svg', 'gate_closed.svg', 'red');
copyIconWithDifferentColor('dot.svg', 'spring.svg', '#1e80e3ff');
copyIconWithDifferentColor('shield_black.svg', 'shield_red.svg', 'red');
copyIconWithDifferentColor('shield_black.svg', 'shield_green.svg', 'green');
copyIconWithDifferentColor('shield_black.svg', 'shield_blue.svg', 'blue');

// Copy icons that do not need a halo
const otherIcons = fs.readdirSync(iconsDir).filter(file => !haloIcons.includes(file));

for (let file of otherIcons) {
    fs.copyFileSync(path.join(iconsDir, file), path.join(inputDir, file));
}

copyIconWithDifferentColor('red_nesw_pattern.svg', 'orange_nesw_pattern.svg', '#ffa500ff');
copyIconWithDifferentColor('red_nwse_pattern.svg', 'orange_nwse_pattern.svg', '#ffa500ff');
copyIconWithDifferentColor('red_nesw_pattern.svg', 'green_nesw_pattern.svg', '#008000ff');

console.log("Running docker image to generate sprites...");
// Generate sprites using the docker image
execSync(`docker run --rm -v ${inputDir}:/app/input -v ${publishDir}:/app/output ${dockerImage} input output/sprite`);
execSync(`docker run --rm -v ${inputDir}:/app/input -v ${publishDir}:/app/output ${dockerImage} input --retina output/sprite@2x`);