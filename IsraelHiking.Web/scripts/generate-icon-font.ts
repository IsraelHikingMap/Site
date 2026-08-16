// Generates the ui icon font and its css from the svg folders below - every svg becomes a glyph
// named after its file. Add or replace an svg, run this script, commit the result.
// Folders are in priority order, so if the same name appears twice the first folder wins.
// The output is deterministic: regenerating without changing an svg produces no diff.
import { SVGIcons2SVGFontStream } from 'svgicons2svgfont';
import svg2ttf from 'svg2ttf';
import { compress } from 'wawoff2';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

const svgFolders = [
    './scripts/font-SVGs',
    './scripts/SVGs'
];
/** Map artwork that is never a ui icon, regardless of what the file happens to be called. */
const spriteOnlyArtwork = [/pattern/, /^arrowline$/, /^arrowhead$/, /^triangle$/, /^dot$/];
/**
 * Icon classes drawn by an svg filed under a different name. Keeps both names working, since class
 * names appear in saved user data and cannot simply be renamed.
 */
const aliases: Record<string, string> = {
    archaeological: 'jar',
    bed: 'hotel',
    campsite: 'camping',
    circle: 'dot',
    flowers: 'flower',
    gate: 'gate-open',
    memorial: 'monument',
    waterhole: 'water-hole'
};
const fontName = 'mapeak';
const outputFont = `./src/fonts/${fontName}.woff2`;
const outputCss = './src/fonts/icons.css';
/**
 * Private use area. Codepoints are an implementation detail - the css maps names to them - but they
 * are sticky: an icon keeps the one it was first given and a new icon is appended above the highest
 * assigned so far. Renumbering them instead would rewrite the whole css for a single new icon, and
 * would make anything still holding the previous font draw the wrong glyph for every icon that moved.
 */
const firstCodepoint = 0xe900;

/** Every svg in every folder, keyed by icon name, first folder wins. Underscores become dashes. */
function collectAllSvgs(): Map<string, string> {
    const all = new Map<string, string>();
    for (const folder of svgFolders) {
        for (const file of fs.readdirSync(folder).filter(f => f.endsWith('.svg')).sort()) {
            const name = path.basename(file, '.svg').replace(/_/g, '-');
            if (!all.has(name)) {
                all.set(name, path.join(folder, file));
            }
        }
    }
    return all;
}

/** The glyphs to build, with aliases resolved to the artwork they borrow. */
function collectIcons(): Map<string, string> {
    const allSvgs = collectAllSvgs();
    const icons = new Map<string, string>();
    for (const [name, file] of allSvgs) {
        if (!spriteOnlyArtwork.some(rule => rule.test(name))) {
            icons.set(name, file);
        }
    }
    for (const [name, target] of Object.entries(aliases)) {
        icons.set(name, allSvgs.get(target));
    }
    return icons;
}

/** What the previous run assigned, read back from the css it wrote. */
function readAssignedCodepoints(): Map<string, number> {
    if (!fs.existsSync(outputCss)) {
        return new Map();
    }
    const rules = fs.readFileSync(outputCss, 'utf8').matchAll(/\.icon-([\w-]+):before \{\s+content: "\\([0-9a-f]+)";/g);
    return new Map([...rules].map(rule => [rule[1], parseInt(rule[2], 16)]));
}

/**
 * A codepoint per icon, in name order. Known icons keep theirs, new ones go above every codepoint
 * assigned so far - including those of deleted icons, so that a name never inherits a stale glyph.
 */
function assignCodepoints(names: string[]): Map<string, number> {
    const assigned = readAssignedCodepoints();
    let nextCodepoint = Math.max(firstCodepoint - 1, ...assigned.values()) + 1;
    return new Map(names.sort().map(name => [name, assigned.get(name) ?? nextCodepoint++]));
}

/** Strips fills so that a white sprite icon does not become an invisible glyph. */
function readMonochromeSvg(file: string): string {
    return fs.readFileSync(file, 'utf8')
        .replace(/\s(fill|stroke)="(?!none)[^"]*"/g, '')
        .replace(/(fill|stroke)\s*:\s*(?!none)[^;"]*;?/g, '');
}

/** Pads the view box out to a square so that a wide icon does not become a glyph wider than one em. */
function squareUpSvg(svg: string): string {
    const viewBox = svg.match(/viewBox="([-\d.]+)\s+([-\d.]+)\s+([\d.]+)\s+([\d.]+)"/);
    if (viewBox == null) {
        return svg;
    }
    const [minX, minY, width, height] = viewBox.slice(1).map(Number);
    const side = Math.max(width, height);
    const squared = `viewBox="${minX - (side - width) / 2} ${minY - (side - height) / 2} ${side} ${side}"`;
    return svg.replace(viewBox[0], squared)
        .replace(/\s(width|height)="[\d.]+"/g, ` $1="${side}"`);
}

/**
 * Builds the intermediate svg font. Glyphs are given a single shared advance width so that the
 * icons line up with each other in the fixed size buttons they sit in.
 */
function buildSvgFont(icons: Map<string, string>, codepoints: Map<string, number>): Promise<string> {
    return new Promise((resolve, reject) => {
        const stream = new SVGIcons2SVGFontStream({
            fontName,
            normalize: true,
            fixedWidth: true,
            centerHorizontally: true,
            centerVertically: true,
            fontHeight: 1000
        });
        let svgFont = '';
        stream.on('data', (chunk: Buffer) => svgFont += chunk.toString());
        stream.on('end', () => resolve(svgFont));
        stream.on('error', reject);
        for (const [name, file] of icons) {
            const glyph = Readable.from([squareUpSvg(readMonochromeSvg(file))]) as Readable & { metadata?: unknown };
            glyph.metadata = { unicode: [String.fromCodePoint(codepoints.get(name))], name };
            stream.write(glyph);
        }
        stream.end();
    });
}

function buildCss(codepoints: Map<string, number>): string {
    const header =
`/* Generated by scripts/generate-icon-font.ts - do not edit by hand. */
@font-face {
  font-family: '${fontName}';
  src: url('${fontName}.woff2') format('woff2');
  font-weight: normal;
  font-style: normal;
  font-display: block;
}

[class^="icon-"], [class*=" icon-"] {
  /* use !important to prevent issues with browser extensions that change fonts */
  font-family: '${fontName}' !important;
  speak: never;
  font-style: normal;
  font-weight: normal;
  font-variant: normal;
  text-transform: none;
  line-height: 1;

  /* Better Font Rendering =========== */
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
`;
    const rules = [...codepoints.entries()]
        .map(([name, codepoint]) => `\n.icon-${name}:before {\n  content: "\\${codepoint.toString(16)}";\n}\n`);
    return header + rules.join('');
}

const icons = collectIcons();
const codepoints = assignCodepoints([...icons.keys()]);

const svgFont = await buildSvgFont(icons, codepoints);
const ttf = Buffer.from(svg2ttf(svgFont, { description: 'Mapeak icons', url: 'https://mapeak.com', ts: 0 }).buffer);
fs.writeFileSync(outputFont, await compress(ttf));
fs.writeFileSync(outputCss, buildCss(codepoints));

console.log(`Wrote ${outputFont} (${(fs.statSync(outputFont).size / 1024).toFixed(1)}kb) with ${icons.size} icons`);
console.log(`Wrote ${outputCss}`);
