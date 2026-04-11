/*! *****************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */
/* global Reflect, Promise */


function __rest(s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
}

function __awaiter(thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, [])).next());
    });
}

function sortedEntries(object) {
    const entries = Object.entries(object);
    entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return entries;
}
function decodeThresholds(thresholds) {
    return Object.fromEntries(thresholds
        .split("~")
        .map((part) => part.split("*").map(Number))
        .map(([key, ...values]) => [key, values]));
}
function decodeOptions(options) {
    return Object.fromEntries(options
        .replace(/^.*\?/, "")
        .split("&")
        .map((part) => {
        const parts = part.split("=").map(decodeURIComponent);
        const k = parts[0];
        let v = parts[1];
        switch (k) {
            case "thresholds":
                v = decodeThresholds(v);
                break;
            case "extent":
            case "multiplier":
            case "overzoom":
            case "buffer":
                v = Number(v);
        }
        return [k, v];
    }));
}
function encodeIndividualOptions(options) {
    return sortedEntries(options)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join(",");
}
function getOptionsForZoom(options, zoom) {
    const { thresholds } = options, rest = __rest(options, ["thresholds"]);
    let levels = [];
    let maxLessThanOrEqualTo = -Infinity;
    Object.entries(thresholds).forEach(([zString, value]) => {
        const z = Number(zString);
        if (z <= zoom && z > maxLessThanOrEqualTo) {
            maxLessThanOrEqualTo = z;
            levels = typeof value === "number" ? [value] : value;
        }
    });
    return Object.assign({ levels }, rest);
}
let supportsOffscreenCanvas = null;
function offscreenCanvasSupported() {
    if (supportsOffscreenCanvas == null) {
        supportsOffscreenCanvas =
            typeof OffscreenCanvas !== "undefined" &&
                new OffscreenCanvas(1, 1).getContext("2d") &&
                typeof createImageBitmap === "function";
    }
    return supportsOffscreenCanvas || false;
}
let useVideoFrame = null;
function shouldUseVideoFrame() {
    if (useVideoFrame == null) {
        useVideoFrame = false;
        // if webcodec is supported, AND if the browser mangles getImageData results
        // (ie. safari with increased privacy protections) then use webcodec VideoFrame API
        if (offscreenCanvasSupported() && typeof VideoFrame !== "undefined") {
            const size = 5;
            const canvas = new OffscreenCanvas(5, 5);
            const context = canvas.getContext("2d", { willReadFrequently: true });
            if (context) {
                for (let i = 0; i < size * size; i++) {
                    const base = i * 4;
                    context.fillStyle = `rgb(${base},${base + 1},${base + 2})`;
                    context.fillRect(i % size, Math.floor(i / size), 1, 1);
                }
                const data = context.getImageData(0, 0, size, size).data;
                for (let i = 0; i < size * size * 4; i++) {
                    if (i % 4 !== 3 && data[i] !== i) {
                        useVideoFrame = true;
                        break;
                    }
                }
            }
        }
    }
    return useVideoFrame || false;
}
function withTimeout(timeoutMs, value, abortController) {
    let reject = () => { };
    const timeout = setTimeout(() => {
        reject(new Error("timed out"));
        abortController === null || abortController === void 0 ? void 0 : abortController.abort();
    }, timeoutMs);
    onAbort(abortController, () => {
        reject(new Error("aborted"));
        clearTimeout(timeout);
    });
    const cancelPromise = new Promise((_, rej) => {
        reject = rej;
    });
    return Promise.race([
        cancelPromise,
        value.finally(() => clearTimeout(timeout)),
    ]);
}
function onAbort(abortController, action) {
    if (action) {
        abortController === null || abortController === void 0 ? void 0 : abortController.signal.addEventListener("abort", action);
    }
}
function isAborted(abortController) {
    var _a;
    return Boolean((_a = abortController === null || abortController === void 0 ? void 0 : abortController.signal) === null || _a === void 0 ? void 0 : _a.aborted);
}

let num = 0;
/**
 * LRU Cache for CancelablePromises.
 * The underlying request is only canceled when all callers have canceled their usage of it.
 */
class AsyncCache {
    constructor(maxSize = 100) {
        this.size = () => this.items.size;
        this.get = (key, supplier, abortController) => {
            let result = this.items.get(key);
            if (!result) {
                const sharedAbortController = new AbortController();
                const value = supplier(key, sharedAbortController);
                result = {
                    abortController: sharedAbortController,
                    item: value,
                    lastUsed: ++num,
                    waiting: 1,
                };
                this.items.set(key, result);
                this.prune();
            }
            else {
                result.lastUsed = ++num;
                result.waiting++;
            }
            const items = this.items;
            const value = result.item.then((r) => r, (e) => {
                items.delete(key);
                return Promise.reject(e);
            });
            let canceled = false;
            onAbort(abortController, () => {
                var _a;
                if (result && result.abortController && !canceled) {
                    canceled = true;
                    if (--result.waiting <= 0) {
                        (_a = result.abortController) === null || _a === void 0 ? void 0 : _a.abort();
                        items.delete(key);
                    }
                }
            });
            return value;
        };
        this.clear = () => this.items.clear();
        this.maxSize = maxSize;
        this.items = new Map();
    }
    prune() {
        if (this.items.size > this.maxSize) {
            let minKey;
            let minUse = Infinity;
            this.items.forEach((value, key) => {
                if (value.lastUsed < minUse) {
                    minUse = value.lastUsed;
                    minKey = key;
                }
            });
            if (typeof minKey !== "undefined") {
                this.items.delete(minKey);
            }
        }
    }
}

let offscreenCanvas;
let offscreenContext;
let canvas;
let canvasContext;
/**
 * Parses a `raster-dem` image into a DemTile using Webcoded VideoFrame API.
 */
function decodeImageModern(blob, encoding, abortController) {
    return __awaiter(this, void 0, void 0, function* () {
        const img = yield createImageBitmap(blob);
        if (isAborted(abortController))
            return null;
        return decodeImageUsingOffscreenCanvas(img, encoding);
    });
}
function decodeImageUsingOffscreenCanvas(img, encoding) {
    if (!offscreenCanvas) {
        offscreenCanvas = new OffscreenCanvas(img.width, img.height);
        offscreenContext = offscreenCanvas.getContext("2d", {
            willReadFrequently: true,
        });
    }
    return getElevations(img, encoding, offscreenCanvas, offscreenContext);
}
/**
 * Parses a `raster-dem` image into a DemTile using webcodec VideoFrame API which works
 * even when browsers disable/degrade the canvas getImageData API as a privacy protection.
 */
function decodeImageVideoFrame(blob, encoding, abortController) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c;
        const img = yield createImageBitmap(blob);
        if (isAborted(abortController))
            return null;
        const vf = new VideoFrame(img, { timestamp: 0 });
        try {
            // formats we can handle: BGRX, BGRA, RGBA, RGBX
            const valid = ((_a = vf === null || vf === void 0 ? void 0 : vf.format) === null || _a === void 0 ? void 0 : _a.startsWith("BGR")) || ((_b = vf === null || vf === void 0 ? void 0 : vf.format) === null || _b === void 0 ? void 0 : _b.startsWith("RGB"));
            if (!valid) {
                throw new Error(`Unrecognized format: ${vf === null || vf === void 0 ? void 0 : vf.format}`);
            }
            const swapBR = (_c = vf === null || vf === void 0 ? void 0 : vf.format) === null || _c === void 0 ? void 0 : _c.startsWith("BGR");
            const size = vf.allocationSize();
            const data = new Uint8ClampedArray(size);
            yield vf.copyTo(data);
            if (swapBR) {
                for (let i = 0; i < data.length; i += 4) {
                    const tmp = data[i];
                    data[i] = data[i + 2];
                    data[i + 2] = tmp;
                }
            }
            return decodeParsedImage(img.width, img.height, encoding, data);
        }
        catch (_) {
            if (isAborted(abortController))
                return null;
            // fall back to offscreen canvas
            return decodeImageUsingOffscreenCanvas(img, encoding);
        }
        finally {
            vf.close();
        }
    });
}
/**
 * Parses a `raster-dem` image into a DemTile using `<img>` element drawn to a `<canvas>`.
 * Only works on the main thread, but works across all browsers.
 */
function decodeImageOld(blob, encoding, abortController) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!canvas) {
            canvas = document.createElement("canvas");
            canvasContext = canvas.getContext("2d", {
                willReadFrequently: true,
            });
        }
        const img = new Image();
        onAbort(abortController, () => (img.src = ""));
        const fetchedImage = yield new Promise((resolve, reject) => {
            img.onload = () => {
                if (!isAborted(abortController))
                    resolve(img);
                URL.revokeObjectURL(img.src);
                img.onload = null;
            };
            img.onerror = () => reject(new Error("Could not load image."));
            img.src = blob.size ? URL.createObjectURL(blob) : "";
        });
        return getElevations(fetchedImage, encoding, canvas, canvasContext);
    });
}
/**
 * Parses a `raster-dem` image in a worker that doesn't support OffscreenCanvas and createImageBitmap
 * by running decodeImageOld on the main thread and returning the result.
 */
function decodeImageOnMainThread(blob, encoding, abortController) {
    return self.actor.send("decodeImage", [], abortController, undefined, blob, encoding);
}
function isWorker() {
    return (
    // @ts-expect-error WorkerGlobalScope defined
    typeof WorkerGlobalScope !== "undefined" &&
        typeof self !== "undefined" &&
        // @ts-expect-error WorkerGlobalScope defined
        self instanceof WorkerGlobalScope);
}
const defaultDecoder = shouldUseVideoFrame()
    ? decodeImageVideoFrame
    : offscreenCanvasSupported()
        ? decodeImageModern
        : isWorker()
            ? decodeImageOnMainThread
            : decodeImageOld;
function getElevations(img, encoding, canvas, canvasContext) {
    canvas.width = img.width;
    canvas.height = img.height;
    if (!canvasContext)
        throw new Error("failed to get context");
    canvasContext.drawImage(img, 0, 0, img.width, img.height);
    const rgba = canvasContext.getImageData(0, 0, img.width, img.height).data;
    return decodeParsedImage(img.width, img.height, encoding, rgba);
}
function decodeParsedImage(width, height, encoding, input) {
    const decoder = encoding === "mapbox"
        ? (r, g, b) => -1e4 + (r * 256 * 256 + g * 256 + b) * 0.1
        : (r, g, b) => r * 256 + g + b / 256 - 32768;
    const data = new Float32Array(width * height);
    for (let i = 0; i < input.length; i += 4) {
        data[i / 4] = decoder(input[i], input[i + 1], input[i + 2]);
    }
    return { width, height, data };
}

const MIN_VALID_M = -12e3;
const MAX_VALID_M = 9000;
function defaultIsValid(number) {
    return !isNaN(number) && number >= MIN_VALID_M && number <= MAX_VALID_M;
}
/** A tile containing elevation values aligned to a grid. */
class HeightTile {
    constructor(width, height, get) {
        /**
         * Splits this tile into a `1<<subz` x `1<<subz` grid and returns the tile at coordinates `subx, suby`.
         */
        this.split = (subz, subx, suby) => {
            if (subz === 0)
                return this;
            const by = 1 << subz;
            const dx = (subx * this.width) / by;
            const dy = (suby * this.height) / by;
            return new HeightTile(this.width / by, this.height / by, (x, y) => this.get(x + dx, y + dy));
        };
        /**
         * Returns a new tile scaled up by `factor` with pixel values that are subsampled using
         * bilinear interpolation between the original height tile values.
         *
         * The original and result tile are assumed to represent values taken at the center of each pixel.
         */
        this.subsamplePixelCenters = (factor) => {
            const lerp = (a, b, f) => isNaN(a) ? b : isNaN(b) ? a : a + (b - a) * f;
            if (factor <= 1)
                return this;
            const sub = 0.5 - 1 / (2 * factor);
            const blerper = (x, y) => {
                const dx = x / factor - sub;
                const dy = y / factor - sub;
                const ox = Math.floor(dx);
                const oy = Math.floor(dy);
                const a = this.get(ox, oy);
                const b = this.get(ox + 1, oy);
                const c = this.get(ox, oy + 1);
                const d = this.get(ox + 1, oy + 1);
                const fx = dx - ox;
                const fy = dy - oy;
                const top = lerp(a, b, fx);
                const bottom = lerp(c, d, fx);
                return lerp(top, bottom, fy);
            };
            return new HeightTile(this.width * factor, this.height * factor, blerper);
        };
        /**
         * Assumes the input tile represented measurements taken at the center of each pixel, and
         * returns a new tile where values are the height at the top-left of each pixel by averaging
         * the 4 adjacent pixel values.
         */
        this.averagePixelCentersToGrid = (radius = 1) => new HeightTile(this.width + 1, this.height + 1, (x, y) => {
            let sum = 0, count = 0, v = 0;
            for (let newX = x - radius; newX < x + radius; newX++) {
                for (let newY = y - radius; newY < y + radius; newY++) {
                    if (!isNaN((v = this.get(newX, newY)))) {
                        count++;
                        sum += v;
                    }
                }
            }
            return count === 0 ? NaN : sum / count;
        });
        /** Returns a new tile with elevation values scaled by `multiplier`. */
        this.scaleElevation = (multiplier) => multiplier === 1
            ? this
            : new HeightTile(this.width, this.height, (x, y) => this.get(x, y) * multiplier);
        /**
         * Precompute every value from `-bufer, -buffer` to `width + buffer, height + buffer` and serve them
         * out of a `Float32Array`. Until this method is called, all `get` requests are lazy and call all previous
         * methods in the chain up to the root DEM tile.
         */
        this.materialize = (buffer = 2) => {
            const stride = this.width + 2 * buffer;
            const data = new Float32Array(stride * (this.height + 2 * buffer));
            let idx = 0;
            for (let y = -buffer; y < this.height + buffer; y++) {
                for (let x = -buffer; x < this.width + buffer; x++) {
                    data[idx++] = this.get(x, y);
                }
            }
            return new HeightTile(this.width, this.height, (x, y) => data[(y + buffer) * stride + x + buffer]);
        };
        this.get = get;
        this.width = width;
        this.height = height;
    }
    /** Construct a height tile from raw DEM pixel values */
    static fromRawDem(demTile) {
        return new HeightTile(demTile.width, demTile.height, (x, y) => {
            const value = demTile.data[y * demTile.width + x];
            return defaultIsValid(value) ? value : NaN;
        });
    }
    /**
     * Construct a height tile from a DEM tile plus it's 8 neighbors, so that
     * you can request `x` or `y` outside the bounds of the original tile.
     *
     * @param neighbors An array containing tiles: `[nw, n, ne, w, c, e, sw, s, se]`
     */
    static combineNeighbors(neighbors) {
        if (neighbors.length !== 9) {
            throw new Error("Must include a tile plus 8 neighbors");
        }
        const mainTile = neighbors[4];
        if (!mainTile) {
            return undefined;
        }
        const width = mainTile.width;
        const height = mainTile.height;
        return new HeightTile(width, height, (x, y) => {
            let gridIdx = 0;
            if (y < 0) {
                y += height;
            }
            else if (y < height) {
                gridIdx += 3;
            }
            else {
                y -= height;
                gridIdx += 6;
            }
            if (x < 0) {
                x += width;
            }
            else if (x < width) {
                gridIdx += 1;
            }
            else {
                x -= width;
                gridIdx += 2;
            }
            const grid = neighbors[gridIdx];
            return grid ? grid.get(x, y) : NaN;
        });
    }
}

/*
Adapted from d3-contour https://github.com/d3/d3-contour

Copyright 2012-2023 Mike Bostock

Permission to use, copy, modify, and/or distribute this software for any purpose
with or without fee is hereby granted, provided that the above copyright notice
and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND
FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS
OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER
TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF
THIS SOFTWARE.
*/
class Fragment {
    constructor(start, end) {
        this.start = start;
        this.end = end;
        this.points = [];
        this.append = this.append.bind(this);
        this.prepend = this.prepend.bind(this);
    }
    append(x, y) {
        this.points.push(Math.round(x), Math.round(y));
    }
    prepend(x, y) {
        this.points.splice(0, 0, Math.round(x), Math.round(y));
    }
    lineString() {
        return this.toArray();
    }
    isEmpty() {
        return this.points.length < 2;
    }
    appendFragment(other) {
        this.points.push(...other.points);
        this.end = other.end;
    }
    toArray() {
        return this.points;
    }
}
const CASES = [
    [],
    [
        [
            [1, 2],
            [0, 1],
        ],
    ],
    [
        [
            [2, 1],
            [1, 2],
        ],
    ],
    [
        [
            [2, 1],
            [0, 1],
        ],
    ],
    [
        [
            [1, 0],
            [2, 1],
        ],
    ],
    [
        [
            [1, 2],
            [0, 1],
        ],
        [
            [1, 0],
            [2, 1],
        ],
    ],
    [
        [
            [1, 0],
            [1, 2],
        ],
    ],
    [
        [
            [1, 0],
            [0, 1],
        ],
    ],
    [
        [
            [0, 1],
            [1, 0],
        ],
    ],
    [
        [
            [1, 2],
            [1, 0],
        ],
    ],
    [
        [
            [0, 1],
            [1, 0],
        ],
        [
            [2, 1],
            [1, 2],
        ],
    ],
    [
        [
            [2, 1],
            [1, 0],
        ],
    ],
    [
        [
            [0, 1],
            [2, 1],
        ],
    ],
    [
        [
            [1, 2],
            [2, 1],
        ],
    ],
    [
        [
            [0, 1],
            [1, 2],
        ],
    ],
    [],
];
function index(width, x, y, point) {
    x = x * 2 + point[0];
    y = y * 2 + point[1];
    return x + y * (width + 1) * 2;
}
function ratio(a, b, c) {
    return (b - a) / (c - a);
}
/**
 * Generates contour lines from a HeightTile
 *
 * @param interval Vertical distance between contours
 * @param tile The input height tile, where values represent the height at the top-left of each pixel
 * @param extent Vector tile extent (default 4096)
 * @param buffer How many pixels into each neighboring tile to include in a tile
 * @returns an object where keys are the elevation, and values are a list of `[x1, y1, x2, y2, ...]`
 * contour lines in tile coordinates
 */
function generateIsolines(interval, tile, extent = 4096, buffer = 1) {
    if (!interval) {
        return {};
    }
    const multiplier = extent / (tile.width - 1);
    let tld, trd, bld, brd;
    let r, c;
    const segments = {};
    const fragmentByStartByLevel = new Map();
    const fragmentByEndByLevel = new Map();
    function interpolate(point, threshold, accept) {
        if (point[0] === 0) {
            // left
            accept(multiplier * (c - 1), multiplier * (r - ratio(bld, threshold, tld)));
        }
        else if (point[0] === 2) {
            // right
            accept(multiplier * c, multiplier * (r - ratio(brd, threshold, trd)));
        }
        else if (point[1] === 0) {
            // top
            accept(multiplier * (c - ratio(trd, threshold, tld)), multiplier * (r - 1));
        }
        else {
            // bottom
            accept(multiplier * (c - ratio(brd, threshold, bld)), multiplier * r);
        }
    }
    // Most marching-squares implementations (d3-contour, gdal-contour) make one pass through the matrix per threshold.
    // This implementation makes a single pass through the matrix, building up all of the contour lines at the
    // same time to improve performance.
    for (r = 1 - buffer; r < tile.height + buffer; r++) {
        trd = tile.get(0, r - 1);
        brd = tile.get(0, r);
        let minR = Math.min(trd, brd);
        let maxR = Math.max(trd, brd);
        for (c = 1 - buffer; c < tile.width + buffer; c++) {
            tld = trd;
            bld = brd;
            trd = tile.get(c, r - 1);
            brd = tile.get(c, r);
            const minL = minR;
            const maxL = maxR;
            minR = Math.min(trd, brd);
            maxR = Math.max(trd, brd);
            if (isNaN(tld) || isNaN(trd) || isNaN(brd) || isNaN(bld)) {
                continue;
            }
            const min = Math.min(minL, minR);
            const max = Math.max(maxL, maxR);
            const start = Math.ceil(min / interval) * interval;
            const end = Math.floor(max / interval) * interval;
            for (let threshold = start; threshold <= end; threshold += interval) {
                const tl = tld > threshold;
                const tr = trd > threshold;
                const bl = bld > threshold;
                const br = brd > threshold;
                for (const segment of CASES[(tl ? 8 : 0) | (tr ? 4 : 0) | (br ? 2 : 0) | (bl ? 1 : 0)]) {
                    let fragmentByStart = fragmentByStartByLevel.get(threshold);
                    if (!fragmentByStart)
                        fragmentByStartByLevel.set(threshold, (fragmentByStart = new Map()));
                    let fragmentByEnd = fragmentByEndByLevel.get(threshold);
                    if (!fragmentByEnd)
                        fragmentByEndByLevel.set(threshold, (fragmentByEnd = new Map()));
                    const start = segment[0];
                    const end = segment[1];
                    const startIndex = index(tile.width, c, r, start);
                    const endIndex = index(tile.width, c, r, end);
                    let f, g;
                    if ((f = fragmentByEnd.get(startIndex))) {
                        fragmentByEnd.delete(startIndex);
                        if ((g = fragmentByStart.get(endIndex))) {
                            fragmentByStart.delete(endIndex);
                            if (f === g) {
                                // closing a ring
                                interpolate(end, threshold, f.append);
                                if (!f.isEmpty()) {
                                    let list = segments[threshold];
                                    if (!list) {
                                        segments[threshold] = list = [];
                                    }
                                    list.push(f.lineString());
                                }
                            }
                            else {
                                // connecting 2 segments
                                f.appendFragment(g);
                                fragmentByEnd.set((f.end = g.end), f);
                            }
                        }
                        else {
                            // adding to the end of f
                            interpolate(end, threshold, f.append);
                            fragmentByEnd.set((f.end = endIndex), f);
                        }
                    }
                    else if ((f = fragmentByStart.get(endIndex))) {
                        fragmentByStart.delete(endIndex);
                        // extending the start of f
                        interpolate(start, threshold, f.prepend);
                        fragmentByStart.set((f.start = startIndex), f);
                    }
                    else {
                        // starting a new fragment
                        const newFrag = new Fragment(startIndex, endIndex);
                        interpolate(start, threshold, newFrag.append);
                        interpolate(end, threshold, newFrag.append);
                        fragmentByStart.set(startIndex, newFrag);
                        fragmentByEnd.set(endIndex, newFrag);
                    }
                }
            }
        }
    }
    for (const [level, fragmentByStart] of fragmentByStartByLevel.entries()) {
        let list = null;
        for (const value of fragmentByStart.values()) {
            if (!value.isEmpty()) {
                if (list == null) {
                    list = segments[level] || (segments[level] = []);
                }
                list.push(value.lineString());
            }
        }
    }
    return segments;
}

const SHIFT_LEFT_32 = (1 << 16) * (1 << 16);
const SHIFT_RIGHT_32 = 1 / SHIFT_LEFT_32;

// Threshold chosen based on both benchmarking and knowledge about browser string
// data structures (which currently switch structure types at 12 bytes or more)
const TEXT_DECODER_MIN_LENGTH = 12;
const utf8TextDecoder = typeof TextDecoder === 'undefined' ? null : new TextDecoder('utf-8');

const PBF_VARINT  = 0; // varint: int32, int64, uint32, uint64, sint32, sint64, bool, enum
const PBF_FIXED64 = 1; // 64-bit: double, fixed64, sfixed64
const PBF_BYTES   = 2; // length-delimited: string, bytes, embedded messages, packed repeated fields
const PBF_FIXED32 = 5; // 32-bit: float, fixed32, sfixed32

class Pbf {
    /**
     * @param {Uint8Array | ArrayBuffer} [buf]
     */
    constructor(buf = new Uint8Array(16)) {
        this.buf = ArrayBuffer.isView(buf) ? buf : new Uint8Array(buf);
        this.dataView = new DataView(this.buf.buffer);
        this.pos = 0;
        this.type = 0;
        this.length = this.buf.length;
    }

    // === READING =================================================================

    /**
     * @template T
     * @param {(tag: number, result: T, pbf: Pbf) => void} readField
     * @param {T} result
     * @param {number} [end]
     */
    readFields(readField, result, end = this.length) {
        while (this.pos < end) {
            const val = this.readVarint(),
                tag = val >> 3,
                startPos = this.pos;

            this.type = val & 0x7;
            readField(tag, result, this);

            if (this.pos === startPos) this.skip(val);
        }
        return result;
    }

    /**
     * @template T
     * @param {(tag: number, result: T, pbf: Pbf) => void} readField
     * @param {T} result
     */
    readMessage(readField, result) {
        return this.readFields(readField, result, this.readVarint() + this.pos);
    }

    readFixed32() {
        const val = this.dataView.getUint32(this.pos, true);
        this.pos += 4;
        return val;
    }

    readSFixed32() {
        const val = this.dataView.getInt32(this.pos, true);
        this.pos += 4;
        return val;
    }

    // 64-bit int handling is based on github.com/dpw/node-buffer-more-ints (MIT-licensed)

    readFixed64() {
        const val = this.dataView.getUint32(this.pos, true) + this.dataView.getUint32(this.pos + 4, true) * SHIFT_LEFT_32;
        this.pos += 8;
        return val;
    }

    readSFixed64() {
        const val = this.dataView.getUint32(this.pos, true) + this.dataView.getInt32(this.pos + 4, true) * SHIFT_LEFT_32;
        this.pos += 8;
        return val;
    }

    readFloat() {
        const val = this.dataView.getFloat32(this.pos, true);
        this.pos += 4;
        return val;
    }

    readDouble() {
        const val = this.dataView.getFloat64(this.pos, true);
        this.pos += 8;
        return val;
    }

    /**
     * @param {boolean} [isSigned]
     */
    readVarint(isSigned) {
        const buf = this.buf;
        let val, b;

        b = buf[this.pos++]; val  =  b & 0x7f;        if (b < 0x80) return val;
        b = buf[this.pos++]; val |= (b & 0x7f) << 7;  if (b < 0x80) return val;
        b = buf[this.pos++]; val |= (b & 0x7f) << 14; if (b < 0x80) return val;
        b = buf[this.pos++]; val |= (b & 0x7f) << 21; if (b < 0x80) return val;
        b = buf[this.pos];   val |= (b & 0x0f) << 28;

        return readVarintRemainder(val, isSigned, this);
    }

    readVarint64() { // for compatibility with v2.0.1
        return this.readVarint(true);
    }

    readSVarint() {
        const num = this.readVarint();
        return num % 2 === 1 ? (num + 1) / -2 : num / 2; // zigzag encoding
    }

    readBoolean() {
        return Boolean(this.readVarint());
    }

    readString() {
        const end = this.readVarint() + this.pos;
        const pos = this.pos;
        this.pos = end;

        if (end - pos >= TEXT_DECODER_MIN_LENGTH && utf8TextDecoder) {
            // longer strings are fast with the built-in browser TextDecoder API
            return utf8TextDecoder.decode(this.buf.subarray(pos, end));
        }
        // short strings are fast with our custom implementation
        return readUtf8(this.buf, pos, end);
    }

    readBytes() {
        const end = this.readVarint() + this.pos,
            buffer = this.buf.subarray(this.pos, end);
        this.pos = end;
        return buffer;
    }

    // verbose for performance reasons; doesn't affect gzipped size

    /**
     * @param {number[]} [arr]
     * @param {boolean} [isSigned]
     */
    readPackedVarint(arr = [], isSigned) {
        const end = this.readPackedEnd();
        while (this.pos < end) arr.push(this.readVarint(isSigned));
        return arr;
    }
    /** @param {number[]} [arr] */
    readPackedSVarint(arr = []) {
        const end = this.readPackedEnd();
        while (this.pos < end) arr.push(this.readSVarint());
        return arr;
    }
    /** @param {boolean[]} [arr] */
    readPackedBoolean(arr = []) {
        const end = this.readPackedEnd();
        while (this.pos < end) arr.push(this.readBoolean());
        return arr;
    }
    /** @param {number[]} [arr] */
    readPackedFloat(arr = []) {
        const end = this.readPackedEnd();
        while (this.pos < end) arr.push(this.readFloat());
        return arr;
    }
    /** @param {number[]} [arr] */
    readPackedDouble(arr = []) {
        const end = this.readPackedEnd();
        while (this.pos < end) arr.push(this.readDouble());
        return arr;
    }
    /** @param {number[]} [arr] */
    readPackedFixed32(arr = []) {
        const end = this.readPackedEnd();
        while (this.pos < end) arr.push(this.readFixed32());
        return arr;
    }
    /** @param {number[]} [arr] */
    readPackedSFixed32(arr = []) {
        const end = this.readPackedEnd();
        while (this.pos < end) arr.push(this.readSFixed32());
        return arr;
    }
    /** @param {number[]} [arr] */
    readPackedFixed64(arr = []) {
        const end = this.readPackedEnd();
        while (this.pos < end) arr.push(this.readFixed64());
        return arr;
    }
    /** @param {number[]} [arr] */
    readPackedSFixed64(arr = []) {
        const end = this.readPackedEnd();
        while (this.pos < end) arr.push(this.readSFixed64());
        return arr;
    }
    readPackedEnd() {
        return this.type === PBF_BYTES ? this.readVarint() + this.pos : this.pos + 1;
    }

    /** @param {number} val */
    skip(val) {
        const type = val & 0x7;
        if (type === PBF_VARINT) while (this.buf[this.pos++] > 0x7f) {}
        else if (type === PBF_BYTES) this.pos = this.readVarint() + this.pos;
        else if (type === PBF_FIXED32) this.pos += 4;
        else if (type === PBF_FIXED64) this.pos += 8;
        else throw new Error(`Unimplemented type: ${type}`);
    }

    // === WRITING =================================================================

    /**
     * @param {number} tag
     * @param {number} type
     */
    writeTag(tag, type) {
        this.writeVarint((tag << 3) | type);
    }

    /** @param {number} min */
    realloc(min) {
        let length = this.length || 16;

        while (length < this.pos + min) length *= 2;

        if (length !== this.length) {
            const buf = new Uint8Array(length);
            buf.set(this.buf);
            this.buf = buf;
            this.dataView = new DataView(buf.buffer);
            this.length = length;
        }
    }

    finish() {
        this.length = this.pos;
        this.pos = 0;
        return this.buf.subarray(0, this.length);
    }

    /** @param {number} val */
    writeFixed32(val) {
        this.realloc(4);
        this.dataView.setInt32(this.pos, val, true);
        this.pos += 4;
    }

    /** @param {number} val */
    writeSFixed32(val) {
        this.realloc(4);
        this.dataView.setInt32(this.pos, val, true);
        this.pos += 4;
    }

    /** @param {number} val */
    writeFixed64(val) {
        this.realloc(8);
        this.dataView.setInt32(this.pos, val & -1, true);
        this.dataView.setInt32(this.pos + 4, Math.floor(val * SHIFT_RIGHT_32), true);
        this.pos += 8;
    }

    /** @param {number} val */
    writeSFixed64(val) {
        this.realloc(8);
        this.dataView.setInt32(this.pos, val & -1, true);
        this.dataView.setInt32(this.pos + 4, Math.floor(val * SHIFT_RIGHT_32), true);
        this.pos += 8;
    }

    /** @param {number} val */
    writeVarint(val) {
        val = +val || 0;

        if (val > 0xfffffff || val < 0) {
            writeBigVarint(val, this);
            return;
        }

        this.realloc(4);

        this.buf[this.pos++] =           val & 0x7f  | (val > 0x7f ? 0x80 : 0); if (val <= 0x7f) return;
        this.buf[this.pos++] = ((val >>>= 7) & 0x7f) | (val > 0x7f ? 0x80 : 0); if (val <= 0x7f) return;
        this.buf[this.pos++] = ((val >>>= 7) & 0x7f) | (val > 0x7f ? 0x80 : 0); if (val <= 0x7f) return;
        this.buf[this.pos++] =   (val >>> 7) & 0x7f;
    }

    /** @param {number} val */
    writeSVarint(val) {
        this.writeVarint(val < 0 ? -val * 2 - 1 : val * 2);
    }

    /** @param {boolean} val */
    writeBoolean(val) {
        this.writeVarint(+val);
    }

    /** @param {string} str */
    writeString(str) {
        str = String(str);
        this.realloc(str.length * 4);

        this.pos++; // reserve 1 byte for short string length

        const startPos = this.pos;
        // write the string directly to the buffer and see how much was written
        this.pos = writeUtf8(this.buf, str, this.pos);
        const len = this.pos - startPos;

        if (len >= 0x80) makeRoomForExtraLength(startPos, len, this);

        // finally, write the message length in the reserved place and restore the position
        this.pos = startPos - 1;
        this.writeVarint(len);
        this.pos += len;
    }

    /** @param {number} val */
    writeFloat(val) {
        this.realloc(4);
        this.dataView.setFloat32(this.pos, val, true);
        this.pos += 4;
    }

    /** @param {number} val */
    writeDouble(val) {
        this.realloc(8);
        this.dataView.setFloat64(this.pos, val, true);
        this.pos += 8;
    }

    /** @param {Uint8Array} buffer */
    writeBytes(buffer) {
        const len = buffer.length;
        this.writeVarint(len);
        this.realloc(len);
        for (let i = 0; i < len; i++) this.buf[this.pos++] = buffer[i];
    }

    /**
     * @template T
     * @param {(obj: T, pbf: Pbf) => void} fn
     * @param {T} obj
     */
    writeRawMessage(fn, obj) {
        this.pos++; // reserve 1 byte for short message length

        // write the message directly to the buffer and see how much was written
        const startPos = this.pos;
        fn(obj, this);
        const len = this.pos - startPos;

        if (len >= 0x80) makeRoomForExtraLength(startPos, len, this);

        // finally, write the message length in the reserved place and restore the position
        this.pos = startPos - 1;
        this.writeVarint(len);
        this.pos += len;
    }

    /**
     * @template T
     * @param {number} tag
     * @param {(obj: T, pbf: Pbf) => void} fn
     * @param {T} obj
     */
    writeMessage(tag, fn, obj) {
        this.writeTag(tag, PBF_BYTES);
        this.writeRawMessage(fn, obj);
    }

    /**
     * @param {number} tag
     * @param {number[]} arr
     */
    writePackedVarint(tag, arr) {
        if (arr.length) this.writeMessage(tag, writePackedVarint, arr);
    }
    /**
     * @param {number} tag
     * @param {number[]} arr
     */
    writePackedSVarint(tag, arr) {
        if (arr.length) this.writeMessage(tag, writePackedSVarint, arr);
    }
    /**
     * @param {number} tag
     * @param {boolean[]} arr
     */
    writePackedBoolean(tag, arr) {
        if (arr.length) this.writeMessage(tag, writePackedBoolean, arr);
    }
    /**
     * @param {number} tag
     * @param {number[]} arr
     */
    writePackedFloat(tag, arr) {
        if (arr.length) this.writeMessage(tag, writePackedFloat, arr);
    }
    /**
     * @param {number} tag
     * @param {number[]} arr
     */
    writePackedDouble(tag, arr) {
        if (arr.length) this.writeMessage(tag, writePackedDouble, arr);
    }
    /**
     * @param {number} tag
     * @param {number[]} arr
     */
    writePackedFixed32(tag, arr) {
        if (arr.length) this.writeMessage(tag, writePackedFixed32, arr);
    }
    /**
     * @param {number} tag
     * @param {number[]} arr
     */
    writePackedSFixed32(tag, arr) {
        if (arr.length) this.writeMessage(tag, writePackedSFixed32, arr);
    }
    /**
     * @param {number} tag
     * @param {number[]} arr
     */
    writePackedFixed64(tag, arr) {
        if (arr.length) this.writeMessage(tag, writePackedFixed64, arr);
    }
    /**
     * @param {number} tag
     * @param {number[]} arr
     */
    writePackedSFixed64(tag, arr) {
        if (arr.length) this.writeMessage(tag, writePackedSFixed64, arr);
    }

    /**
     * @param {number} tag
     * @param {Uint8Array} buffer
     */
    writeBytesField(tag, buffer) {
        this.writeTag(tag, PBF_BYTES);
        this.writeBytes(buffer);
    }
    /**
     * @param {number} tag
     * @param {number} val
     */
    writeFixed32Field(tag, val) {
        this.writeTag(tag, PBF_FIXED32);
        this.writeFixed32(val);
    }
    /**
     * @param {number} tag
     * @param {number} val
     */
    writeSFixed32Field(tag, val) {
        this.writeTag(tag, PBF_FIXED32);
        this.writeSFixed32(val);
    }
    /**
     * @param {number} tag
     * @param {number} val
     */
    writeFixed64Field(tag, val) {
        this.writeTag(tag, PBF_FIXED64);
        this.writeFixed64(val);
    }
    /**
     * @param {number} tag
     * @param {number} val
     */
    writeSFixed64Field(tag, val) {
        this.writeTag(tag, PBF_FIXED64);
        this.writeSFixed64(val);
    }
    /**
     * @param {number} tag
     * @param {number} val
     */
    writeVarintField(tag, val) {
        this.writeTag(tag, PBF_VARINT);
        this.writeVarint(val);
    }
    /**
     * @param {number} tag
     * @param {number} val
     */
    writeSVarintField(tag, val) {
        this.writeTag(tag, PBF_VARINT);
        this.writeSVarint(val);
    }
    /**
     * @param {number} tag
     * @param {string} str
     */
    writeStringField(tag, str) {
        this.writeTag(tag, PBF_BYTES);
        this.writeString(str);
    }
    /**
     * @param {number} tag
     * @param {number} val
     */
    writeFloatField(tag, val) {
        this.writeTag(tag, PBF_FIXED32);
        this.writeFloat(val);
    }
    /**
     * @param {number} tag
     * @param {number} val
     */
    writeDoubleField(tag, val) {
        this.writeTag(tag, PBF_FIXED64);
        this.writeDouble(val);
    }
    /**
     * @param {number} tag
     * @param {boolean} val
     */
    writeBooleanField(tag, val) {
        this.writeVarintField(tag, +val);
    }
}
/**
 * @param {number} l
 * @param {boolean | undefined} s
 * @param {Pbf} p
 */
function readVarintRemainder(l, s, p) {
    const buf = p.buf;
    let h, b;

    b = buf[p.pos++]; h  = (b & 0x70) >> 4;  if (b < 0x80) return toNum(l, h, s);
    b = buf[p.pos++]; h |= (b & 0x7f) << 3;  if (b < 0x80) return toNum(l, h, s);
    b = buf[p.pos++]; h |= (b & 0x7f) << 10; if (b < 0x80) return toNum(l, h, s);
    b = buf[p.pos++]; h |= (b & 0x7f) << 17; if (b < 0x80) return toNum(l, h, s);
    b = buf[p.pos++]; h |= (b & 0x7f) << 24; if (b < 0x80) return toNum(l, h, s);
    b = buf[p.pos++]; h |= (b & 0x01) << 31; if (b < 0x80) return toNum(l, h, s);

    throw new Error('Expected varint not more than 10 bytes');
}

/**
 * @param {number} low
 * @param {number} high
 * @param {boolean} [isSigned]
 */
function toNum(low, high, isSigned) {
    return isSigned ? high * 0x100000000 + (low >>> 0) : ((high >>> 0) * 0x100000000) + (low >>> 0);
}

/**
 * @param {number} val
 * @param {Pbf} pbf
 */
function writeBigVarint(val, pbf) {
    let low, high;

    if (val >= 0) {
        low  = (val % 0x100000000) | 0;
        high = (val / 0x100000000) | 0;
    } else {
        low  = ~(-val % 0x100000000);
        high = ~(-val / 0x100000000);

        if (low ^ 0xffffffff) {
            low = (low + 1) | 0;
        } else {
            low = 0;
            high = (high + 1) | 0;
        }
    }

    if (val >= 0x10000000000000000 || val < -18446744073709552e3) {
        throw new Error('Given varint doesn\'t fit into 10 bytes');
    }

    pbf.realloc(10);

    writeBigVarintLow(low, high, pbf);
    writeBigVarintHigh(high, pbf);
}

/**
 * @param {number} high
 * @param {number} low
 * @param {Pbf} pbf
 */
function writeBigVarintLow(low, high, pbf) {
    pbf.buf[pbf.pos++] = low & 0x7f | 0x80; low >>>= 7;
    pbf.buf[pbf.pos++] = low & 0x7f | 0x80; low >>>= 7;
    pbf.buf[pbf.pos++] = low & 0x7f | 0x80; low >>>= 7;
    pbf.buf[pbf.pos++] = low & 0x7f | 0x80; low >>>= 7;
    pbf.buf[pbf.pos]   = low & 0x7f;
}

/**
 * @param {number} high
 * @param {Pbf} pbf
 */
function writeBigVarintHigh(high, pbf) {
    const lsb = (high & 0x07) << 4;

    pbf.buf[pbf.pos++] |= lsb         | ((high >>>= 3) ? 0x80 : 0); if (!high) return;
    pbf.buf[pbf.pos++]  = high & 0x7f | ((high >>>= 7) ? 0x80 : 0); if (!high) return;
    pbf.buf[pbf.pos++]  = high & 0x7f | ((high >>>= 7) ? 0x80 : 0); if (!high) return;
    pbf.buf[pbf.pos++]  = high & 0x7f | ((high >>>= 7) ? 0x80 : 0); if (!high) return;
    pbf.buf[pbf.pos++]  = high & 0x7f | ((high >>>= 7) ? 0x80 : 0); if (!high) return;
    pbf.buf[pbf.pos++]  = high & 0x7f;
}

/**
 * @param {number} startPos
 * @param {number} len
 * @param {Pbf} pbf
 */
function makeRoomForExtraLength(startPos, len, pbf) {
    const extraLen =
        len <= 0x3fff ? 1 :
        len <= 0x1fffff ? 2 :
        len <= 0xfffffff ? 3 : Math.floor(Math.log(len) / (Math.LN2 * 7));

    // if 1 byte isn't enough for encoding message length, shift the data to the right
    pbf.realloc(extraLen);
    for (let i = pbf.pos - 1; i >= startPos; i--) pbf.buf[i + extraLen] = pbf.buf[i];
}

/**
 * @param {number[]} arr
 * @param {Pbf} pbf
 */
function writePackedVarint(arr, pbf) {
    for (let i = 0; i < arr.length; i++) pbf.writeVarint(arr[i]);
}
/**
 * @param {number[]} arr
 * @param {Pbf} pbf
 */
function writePackedSVarint(arr, pbf) {
    for (let i = 0; i < arr.length; i++) pbf.writeSVarint(arr[i]);
}
/**
 * @param {number[]} arr
 * @param {Pbf} pbf
 */
function writePackedFloat(arr, pbf) {
    for (let i = 0; i < arr.length; i++) pbf.writeFloat(arr[i]);
}
/**
 * @param {number[]} arr
 * @param {Pbf} pbf
 */
function writePackedDouble(arr, pbf) {
    for (let i = 0; i < arr.length; i++) pbf.writeDouble(arr[i]);
}
/**
 * @param {boolean[]} arr
 * @param {Pbf} pbf
 */
function writePackedBoolean(arr, pbf) {
    for (let i = 0; i < arr.length; i++) pbf.writeBoolean(arr[i]);
}
/**
 * @param {number[]} arr
 * @param {Pbf} pbf
 */
function writePackedFixed32(arr, pbf) {
    for (let i = 0; i < arr.length; i++) pbf.writeFixed32(arr[i]);
}
/**
 * @param {number[]} arr
 * @param {Pbf} pbf
 */
function writePackedSFixed32(arr, pbf) {
    for (let i = 0; i < arr.length; i++) pbf.writeSFixed32(arr[i]);
}
/**
 * @param {number[]} arr
 * @param {Pbf} pbf
 */
function writePackedFixed64(arr, pbf) {
    for (let i = 0; i < arr.length; i++) pbf.writeFixed64(arr[i]);
}
/**
 * @param {number[]} arr
 * @param {Pbf} pbf
 */
function writePackedSFixed64(arr, pbf) {
    for (let i = 0; i < arr.length; i++) pbf.writeSFixed64(arr[i]);
}

// Buffer code below from https://github.com/feross/buffer, MIT-licensed

/**
 * @param {Uint8Array} buf
 * @param {number} pos
 * @param {number} end
 */
function readUtf8(buf, pos, end) {
    let str = '';
    let i = pos;

    while (i < end) {
        const b0 = buf[i];
        let c = null; // codepoint
        let bytesPerSequence =
            b0 > 0xEF ? 4 :
            b0 > 0xDF ? 3 :
            b0 > 0xBF ? 2 : 1;

        if (i + bytesPerSequence > end) break;

        let b1, b2, b3;

        if (bytesPerSequence === 1) {
            if (b0 < 0x80) {
                c = b0;
            }
        } else if (bytesPerSequence === 2) {
            b1 = buf[i + 1];
            if ((b1 & 0xC0) === 0x80) {
                c = (b0 & 0x1F) << 0x6 | (b1 & 0x3F);
                if (c <= 0x7F) {
                    c = null;
                }
            }
        } else if (bytesPerSequence === 3) {
            b1 = buf[i + 1];
            b2 = buf[i + 2];
            if ((b1 & 0xC0) === 0x80 && (b2 & 0xC0) === 0x80) {
                c = (b0 & 0xF) << 0xC | (b1 & 0x3F) << 0x6 | (b2 & 0x3F);
                if (c <= 0x7FF || (c >= 0xD800 && c <= 0xDFFF)) {
                    c = null;
                }
            }
        } else if (bytesPerSequence === 4) {
            b1 = buf[i + 1];
            b2 = buf[i + 2];
            b3 = buf[i + 3];
            if ((b1 & 0xC0) === 0x80 && (b2 & 0xC0) === 0x80 && (b3 & 0xC0) === 0x80) {
                c = (b0 & 0xF) << 0x12 | (b1 & 0x3F) << 0xC | (b2 & 0x3F) << 0x6 | (b3 & 0x3F);
                if (c <= 0xFFFF || c >= 0x110000) {
                    c = null;
                }
            }
        }

        if (c === null) {
            c = 0xFFFD;
            bytesPerSequence = 1;

        } else if (c > 0xFFFF) {
            c -= 0x10000;
            str += String.fromCharCode(c >>> 10 & 0x3FF | 0xD800);
            c = 0xDC00 | c & 0x3FF;
        }

        str += String.fromCharCode(c);
        i += bytesPerSequence;
    }

    return str;
}

/**
 * @param {Uint8Array} buf
 * @param {string} str
 * @param {number} pos
 */
function writeUtf8(buf, str, pos) {
    for (let i = 0, c, lead; i < str.length; i++) {
        c = str.charCodeAt(i); // code point

        if (c > 0xD7FF && c < 0xE000) {
            if (lead) {
                if (c < 0xDC00) {
                    buf[pos++] = 0xEF;
                    buf[pos++] = 0xBF;
                    buf[pos++] = 0xBD;
                    lead = c;
                    continue;
                } else {
                    c = lead - 0xD800 << 10 | c - 0xDC00 | 0x10000;
                    lead = null;
                }
            } else {
                if (c > 0xDBFF || (i + 1 === str.length)) {
                    buf[pos++] = 0xEF;
                    buf[pos++] = 0xBF;
                    buf[pos++] = 0xBD;
                } else {
                    lead = c;
                }
                continue;
            }
        } else if (lead) {
            buf[pos++] = 0xEF;
            buf[pos++] = 0xBF;
            buf[pos++] = 0xBD;
            lead = null;
        }

        if (c < 0x80) {
            buf[pos++] = c;
        } else {
            if (c < 0x800) {
                buf[pos++] = c >> 0x6 | 0xC0;
            } else {
                if (c < 0x10000) {
                    buf[pos++] = c >> 0xC | 0xE0;
                } else {
                    buf[pos++] = c >> 0x12 | 0xF0;
                    buf[pos++] = c >> 0xC & 0x3F | 0x80;
                }
                buf[pos++] = c >> 0x6 & 0x3F | 0x80;
            }
            buf[pos++] = c & 0x3F | 0x80;
        }
    }
    return pos;
}

/*
Adapted from vt-pbf https://github.com/mapbox/vt-pbf

The MIT License (MIT)

Copyright (c) 2015 Anand Thakker

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
var GeomType;
(function (GeomType) {
    GeomType[GeomType["UNKNOWN"] = 0] = "UNKNOWN";
    GeomType[GeomType["POINT"] = 1] = "POINT";
    GeomType[GeomType["LINESTRING"] = 2] = "LINESTRING";
    GeomType[GeomType["POLYGON"] = 3] = "POLYGON";
})(GeomType || (GeomType = {}));
/**
 * Enodes and serializes a mapbox vector tile as an array of bytes.
 */
function encodeVectorTile(tile) {
    const pbf = new Pbf();
    for (const id in tile.layers) {
        const layer = tile.layers[id];
        if (!layer.extent) {
            layer.extent = tile.extent;
        }
        pbf.writeMessage(3, writeLayer, Object.assign(Object.assign({}, layer), { id }));
    }
    return pbf.finish();
}
function writeLayer(layer, pbf) {
    if (!pbf)
        throw new Error("pbf undefined");
    pbf.writeStringField(1, layer.id || ""); // name (required, field 1)
    // Write all features (field 2)
    const context = {
        keys: [],
        values: [],
        keycache: {},
        valuecache: {},
    };
    for (const feature of layer.features) {
        context.feature = feature;
        pbf.writeMessage(2, writeFeature, context);
    }
    // Write all keys (field 3)
    for (const key of context.keys) {
        pbf.writeStringField(3, key);
    }
    // Write all values (field 4)
    for (const value of context.values) {
        pbf.writeMessage(4, writeValue, value);
    }
    pbf.writeVarintField(5, layer.extent || 4096); // extent (field 5)
    pbf.writeVarintField(15, 2); // version (field 15, LAST)
}
function writeFeature(context, pbf) {
    const feature = context.feature;
    if (!feature || !pbf)
        throw new Error();
    pbf.writeMessage(2, writeProperties, context);
    pbf.writeVarintField(3, feature.type);
    pbf.writeMessage(4, writeGeometry, feature);
}
function writeProperties(context, pbf) {
    const feature = context.feature;
    if (!feature || !pbf)
        throw new Error();
    const keys = context.keys;
    const values = context.values;
    const keycache = context.keycache;
    const valuecache = context.valuecache;
    for (const key in feature.properties) {
        let value = feature.properties[key];
        let keyIndex = keycache[key];
        if (value === null)
            continue; // don't encode null value properties
        if (typeof keyIndex === "undefined") {
            keys.push(key);
            keyIndex = keys.length - 1;
            keycache[key] = keyIndex;
        }
        pbf.writeVarint(keyIndex);
        const type = typeof value;
        if (type !== "string" && type !== "boolean" && type !== "number") {
            value = JSON.stringify(value);
        }
        const valueKey = `${type}:${value}`;
        let valueIndex = valuecache[valueKey];
        if (typeof valueIndex === "undefined") {
            values.push(value);
            valueIndex = values.length - 1;
            valuecache[valueKey] = valueIndex;
        }
        pbf.writeVarint(valueIndex);
    }
}
function command(cmd, length) {
    return (length << 3) + (cmd & 0x7);
}
function zigzag(num) {
    return (num << 1) ^ (num >> 31);
}
function writeGeometry(feature, pbf) {
    if (!pbf)
        throw new Error();
    const geometry = feature.geometry;
    const type = feature.type;
    let x = 0;
    let y = 0;
    for (const ring of geometry) {
        let count = 1;
        if (type === GeomType.POINT) {
            count = ring.length / 2;
        }
        pbf.writeVarint(command(1, count)); // moveto
        // do not write polygon closing path as lineto
        const length = ring.length / 2;
        const lineCount = type === GeomType.POLYGON ? length - 1 : length;
        for (let i = 0; i < lineCount; i++) {
            if (i === 1 && type !== 1) {
                pbf.writeVarint(command(2, lineCount - 1)); // lineto
            }
            const dx = ring[i * 2] - x;
            const dy = ring[i * 2 + 1] - y;
            pbf.writeVarint(zigzag(dx));
            pbf.writeVarint(zigzag(dy));
            x += dx;
            y += dy;
        }
        if (type === GeomType.POLYGON) {
            pbf.writeVarint(command(7, 1)); // closepath
        }
    }
}
function writeValue(value, pbf) {
    if (!pbf)
        throw new Error();
    if (typeof value === "string") {
        pbf.writeStringField(1, value);
    }
    else if (typeof value === "boolean") {
        pbf.writeBooleanField(7, value);
    }
    else if (typeof value === "number") {
        if (value % 1 !== 0) {
            pbf.writeDoubleField(3, value);
        }
        else if (value < 0) {
            pbf.writeSVarintField(6, value);
        }
        else {
            pbf.writeVarintField(5, value);
        }
    }
}

const perf = typeof performance !== "undefined" ? performance : undefined;
perf
    ? perf.timeOrigin || new Date().getTime() - perf.now()
    : new Date().getTime();

const defaultGetTile = (url, abortController) => __awaiter(void 0, void 0, void 0, function* () {
    const options = {
        signal: abortController.signal,
    };
    const response = yield fetch(url, options);
    if (!response.ok) {
        throw new Error(`Bad response: ${response.status} for ${url}`);
    }
    return {
        data: yield response.blob(),
        expires: response.headers.get("expires") || undefined,
        cacheControl: response.headers.get("cache-control") || undefined,
    };
});
/**
 * Caches, decodes, and processes raster tiles in the current thread.
 */
class LocalDemManager {
    constructor(options) {
        this.loaded = Promise.resolve();
        this.fetchAndParseTile = (z, x, y, abortController, timer) => {
            // eslint-disable-next-line @typescript-eslint/no-this-alias
            const self = this;
            const url = this.demUrlPattern
                .replace("{z}", z.toString())
                .replace("{x}", x.toString())
                .replace("{y}", y.toString());
            timer === null || timer === void 0 ? void 0 : timer.useTile(url);
            return this.parsedCache.get(url, (_, childAbortController) => __awaiter(this, void 0, void 0, function* () {
                const response = yield self.fetchTile(z, x, y, childAbortController, timer);
                if (isAborted(childAbortController))
                    throw new Error("canceled");
                const promise = self.decodeImage(response.data, self.encoding, childAbortController);
                const mark = timer === null || timer === void 0 ? void 0 : timer.marker("decode");
                const result = yield promise;
                mark === null || mark === void 0 ? void 0 : mark();
                return result;
            }), abortController);
        };
        this.tileCache = new AsyncCache(options.cacheSize);
        this.parsedCache = new AsyncCache(options.cacheSize);
        this.contourCache = new AsyncCache(options.cacheSize);
        this.timeoutMs = options.timeoutMs;
        this.demUrlPattern = options.demUrlPattern;
        this.encoding = options.encoding;
        this.maxzoom = options.maxzoom;
        this.decodeImage = options.decodeImage || defaultDecoder;
        this.getTile = options.getTile || defaultGetTile;
    }
    fetchTile(z, x, y, parentAbortController, timer) {
        const url = this.demUrlPattern
            .replace("{z}", z.toString())
            .replace("{x}", x.toString())
            .replace("{y}", y.toString());
        timer === null || timer === void 0 ? void 0 : timer.useTile(url);
        return this.tileCache.get(url, (_, childAbortController) => {
            timer === null || timer === void 0 ? void 0 : timer.fetchTile(url);
            const mark = timer === null || timer === void 0 ? void 0 : timer.marker("fetch");
            return withTimeout(this.timeoutMs, this.getTile(url, childAbortController).finally(() => mark === null || mark === void 0 ? void 0 : mark()), childAbortController);
        }, parentAbortController);
    }
    fetchDem(z, x, y, options, abortController, timer) {
        return __awaiter(this, void 0, void 0, function* () {
            const zoom = Math.min(z - (options.overzoom || 0), this.maxzoom);
            const subZ = z - zoom;
            const div = 1 << subZ;
            const newX = Math.floor(x / div);
            const newY = Math.floor(y / div);
            const tile = yield this.fetchAndParseTile(zoom, newX, newY, abortController, timer);
            return HeightTile.fromRawDem(tile).split(subZ, x % div, y % div);
        });
    }
    fetchContourTile(z, x, y, options, parentAbortController, timer) {
        const { levels, multiplier = 1, buffer = 1, extent = 4096, contourLayer = "contours", elevationKey = "ele", levelKey = "level", subsampleBelow = 100, } = options;
        // no levels means less than min zoom with levels specified
        if (!levels || levels.length === 0) {
            return Promise.resolve({ arrayBuffer: new ArrayBuffer(0) });
        }
        const key = [z, x, y, encodeIndividualOptions(options)].join("/");
        return this.contourCache.get(key, (_, childAbortController) => __awaiter(this, void 0, void 0, function* () {
            const max = 1 << z;
            const neighborPromises = [];
            for (let iy = y - 1; iy <= y + 1; iy++) {
                for (let ix = x - 1; ix <= x + 1; ix++) {
                    neighborPromises.push(iy < 0 || iy >= max
                        ? undefined
                        : this.fetchDem(z, (ix + max) % max, iy, options, childAbortController, timer));
                }
            }
            const neighbors = yield Promise.all(neighborPromises);
            let virtualTile = HeightTile.combineNeighbors(neighbors);
            if (!virtualTile || isAborted(childAbortController)) {
                return { arrayBuffer: new Uint8Array().buffer };
            }
            const mark = timer === null || timer === void 0 ? void 0 : timer.marker("isoline");
            if (virtualTile.width >= subsampleBelow) {
                virtualTile = virtualTile.materialize(2);
            }
            else {
                while (virtualTile.width < subsampleBelow) {
                    virtualTile = virtualTile.subsamplePixelCenters(2).materialize(2);
                }
            }
            virtualTile = virtualTile
                .averagePixelCentersToGrid()
                .scaleElevation(multiplier)
                .materialize(1);
            const isolines = generateIsolines(levels[0], virtualTile, extent, buffer);
            mark === null || mark === void 0 ? void 0 : mark();
            const result = encodeVectorTile({
                extent,
                layers: {
                    [contourLayer]: {
                        features: Object.entries(isolines).map(([eleString, geom]) => {
                            const ele = Number(eleString);
                            return {
                                type: GeomType.LINESTRING,
                                geometry: geom,
                                properties: {
                                    [elevationKey]: ele,
                                    [levelKey]: Math.max(...levels.map((l, i) => (ele % l === 0 ? i : 0))),
                                },
                            };
                        }),
                    },
                },
            });
            mark === null || mark === void 0 ? void 0 : mark();
            return { arrayBuffer: result.slice().buffer };
        }), parentAbortController);
    }
}

console.log("Initializing local DEM manager in worker...");
const localDemManager = new LocalDemManager({
    demUrlPattern: "slice://global.israelhikingmap.workers.dev/jaxa_terrarium0-11_v2/{z}/{x}/{y}.webp",
    cacheSize: 100,
    timeoutMs: 10000,
    encoding: "terrarium",
    maxzoom: 11,
    getTile: (url, abortController) => __awaiter(void 0, void 0, void 0, function* () {
        const actorRes = yield self.worker.actor.sendAsync({ type: "GR", data: { url, type: "arrayBuffer" }, targetMapId: "global-dispatcher" }, abortController);
        return {
            data: new Blob([actorRes.data])
        };
    })
});
self.addProtocol("dem-contour", (request, abortController) => __awaiter(void 0, void 0, void 0, function* () {
    const [, z, x, y] = /\/\/(\d+)\/(\d+)\/(\d+)/.exec(request.url) || [];
    const options = decodeOptions(request.url);
    const data = yield localDemManager.fetchContourTile(Number(z), Number(x), Number(y), getOptionsForZoom(options, Number(z)), abortController);
    return { data: data.arrayBuffer };
}));
