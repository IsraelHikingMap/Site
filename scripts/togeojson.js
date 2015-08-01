var toGeoJSON = (function () {
    'use strict';

    var removeSpace = (/\s*/g),
        trimSpace = (/^\s*|\s*$/g),
        splitSpace = (/\s+/);
    // generate a short, numeric hash of a string
    function okhash(x) {
        if (!x || !x.length) return 0;
        for (var i = 0, h = 0; i < x.length; i++) {
            h = ((h << 5) - h) + x.charCodeAt(i) | 0;
        } return h;
    }
    // all Y children of X
    function get(x, y) { return x.getElementsByTagName(y); }
    function attr(x, y) { return x.getAttribute(y); }
    function attrf(x, y) { return parseFloat(attr(x, y)); }
    // one Y child of X, if any, otherwise null
    function get1(x, y) { var n = get(x, y); return n.length ? n[0] : null; }
    // https://developer.mozilla.org/en-US/docs/Web/API/Node.normalize
    function norm(el) { if (el.normalize) { el.normalize(); } return el; }
    // cast array x into numbers
    function numarray(x) {
        for (var j = 0, o = []; j < x.length; j++) { o[j] = parseFloat(x[j]); }
        return o;
    }
    function clean(x) {
        var o = {};
        for (var i in x) { if (x[i]) { o[i] = x[i]; } }
        return o;
    }
    // get the content of a text node, if any
    function nodeVal(x) {
        if (x) { norm(x); }
        return (x && x.textContent) || '';
    }
    // get one coordinate from a coordinate array, if any
    function coord1(v) { return numarray(v.replace(removeSpace, '').split(',')); }
    // get all coordinates from a coordinate array as [[],[]]
    function coord(v) {
        var coords = v.replace(trimSpace, '').split(splitSpace),
            o = [];
        for (var i = 0; i < coords.length; i++) {
            o.push(coord1(coords[i]));
        }
        return o;
    }
    function coordPair(x) {
        var ll = [attrf(x, 'lon'), attrf(x, 'lat')],
            ele = get1(x, 'ele'),
            // handle namespaced attribute in browser
            heartRate = get1(x, 'gpxtpx:hr') || get1(x, 'hr'),
            time = get1(x, 'time'),
            e;
        if (ele) {
            e = parseFloat(nodeVal(ele));
            if (e) {
                ll.push(e);
            }
        }
        return {
            coordinates: ll,
            time: time ? nodeVal(time) : null,
            heartRate: heartRate ? parseFloat(nodeVal(heartRate)) : null
        };
    }

    // create a new feature collection parent object
    function fc() {
        return {
            type: 'FeatureCollection',
            features: []
        };
    }

    var serializer;
    if (typeof XMLSerializer !== 'undefined') {
        serializer = new XMLSerializer();
        // only require xmldom in a node environment
    } else if (typeof exports === 'object' && typeof process === 'object' && !process.browser) {
        serializer = new (require('xmldom').XMLSerializer)();
    }
    function xml2str(str) {
        // IE9 will create a new XMLSerializer but it'll crash immediately.
        if (str.xml !== undefined) return str.xml;
        return serializer.serializeToString(str);
    }

    var t = {
        kml: function (doc) {

            var gj = fc(),
                // styleindex keeps track of hashed styles in order to match features
                styleIndex = {},
                // atomic geospatial types supported by KML - MultiGeometry is
                // handled separately
                geotypes = ['Polygon', 'LineString', 'Point', 'Track', 'gx:Track'],
                // all root placemarks in the file
                placemarks = get(doc, 'Placemark'),
                styles = get(doc, 'Style');

            for (var k = 0; k < styles.length; k++) {
                styleIndex['#' + attr(styles[k], 'id')] = okhash(xml2str(styles[k])).toString(16);
            }
            for (var j = 0; j < placemarks.length; j++) {
                gj.features = gj.features.concat(getPlacemark(placemarks[j]));
            }
            function kmlColor(v) {
                var color, opacity;
                v = v || "";
                if (v.substr(0, 1) === "#") { v = v.substr(1); }
                if (v.length === 6 || v.length === 3) { color = v; }
                if (v.length === 8) {
                    opacity = parseInt(v.substr(0, 2), 16) / 255;
                    color = v.substr(2);
                }
                return [color, isNaN(opacity) ? undefined : opacity];
            }
            function gxCoord(v) { return numarray(v.split(' ')); }
            function gxCoords(root) {
                var elems = get(root, 'coord', 'gx'), coords = [], times = [];
                if (elems.length === 0) elems = get(root, 'gx:coord');
                for (var i = 0; i < elems.length; i++) coords.push(gxCoord(nodeVal(elems[i])));
                var timeElems = get(root, 'when');
                for (var i = 0; i < timeElems.length; i++) times.push(nodeVal(timeElems[i]));
                return {
                    coords: coords,
                    times: times
                };
            }
            function getGeometry(root) {
                var geomNode, geomNodes, i, j, k, geoms = [], coordTimes = [];
                if (get1(root, 'MultiGeometry')) { return getGeometry(get1(root, 'MultiGeometry')); }
                if (get1(root, 'MultiTrack')) { return getGeometry(get1(root, 'MultiTrack')); }
                if (get1(root, 'gx:MultiTrack')) { return getGeometry(get1(root, 'gx:MultiTrack')); }
                for (i = 0; i < geotypes.length; i++) {
                    geomNodes = get(root, geotypes[i]);
                    if (geomNodes) {
                        for (j = 0; j < geomNodes.length; j++) {
                            geomNode = geomNodes[j];
                            if (geotypes[i] === 'Point') {
                                geoms.push({
                                    type: 'Point',
                                    coordinates: coord1(nodeVal(get1(geomNode, 'coordinates')))
                                });
                            } else if (geotypes[i] === 'LineString') {
                                geoms.push({
                                    type: 'LineString',
                                    coordinates: coord(nodeVal(get1(geomNode, 'coordinates')))
                                });
                            } else if (geotypes[i] === 'Polygon') {
                                var rings = get(geomNode, 'LinearRing'),
                                    coords = [];
                                for (k = 0; k < rings.length; k++) {
                                    coords.push(coord(nodeVal(get1(rings[k], 'coordinates'))));
                                }
                                geoms.push({
                                    type: 'Polygon',
                                    coordinates: coords
                                });
                            } else if (geotypes[i] === 'Track' ||
                                geotypes[i] === 'gx:Track') {
                                var track = gxCoords(geomNode);
                                geoms.push({
                                    type: 'LineString',
                                    coordinates: track.coords
                                });
                                if (track.times.length) coordTimes.push(track.times);
                            }
                        }
                    }
                }
                return {
                    geoms: geoms,
                    coordTimes: coordTimes
                };
            }
            function getPlacemark(root) {
                var geomsAndTimes = getGeometry(root), i, properties = {},
                    name = nodeVal(get1(root, 'name')),
                    styleUrl = nodeVal(get1(root, 'styleUrl')),
                    description = nodeVal(get1(root, 'description')),
                    timeSpan = get1(root, 'TimeSpan'),
                    extendedData = get1(root, 'ExtendedData'),
                    lineStyle = get1(root, 'LineStyle'),
                    polyStyle = get1(root, 'PolyStyle');

                if (!geomsAndTimes.geoms.length) return [];
                if (name) properties.name = name;
                if (styleUrl && styleIndex[styleUrl]) {
                    properties.styleUrl = styleUrl;
                    properties.styleHash = styleIndex[styleUrl];
                }
                if (description) properties.description = description;
                if (timeSpan) {
                    var begin = nodeVal(get1(timeSpan, 'begin'));
                    var end = nodeVal(get1(timeSpan, 'end'));
                    properties.timespan = { begin: begin, end: end };
                }
                if (lineStyle) {
                    var linestyles = kmlColor(nodeVal(get1(lineStyle, 'color'))),
                        color = linestyles[0],
                        opacity = linestyles[1],
                        width = parseFloat(nodeVal(get1(lineStyle, 'width')));
                    if (color) properties.stroke = color;
                    if (!isNaN(opacity)) properties['stroke-opacity'] = opacity;
                    if (!isNaN(width)) properties['stroke-width'] = width;
                }
                if (polyStyle) {
                    var polystyles = kmlColor(nodeVal(get1(polyStyle, 'color'))),
                        pcolor = polystyles[0],
                        popacity = polystyles[1],
                        fill = nodeVal(get1(polyStyle, 'fill')),
                        outline = nodeVal(get1(polyStyle, 'outline'));
                    if (pcolor) properties.fill = pcolor;
                    if (!isNaN(popacity)) properties['fill-opacity'] = popacity;
                    if (fill) properties['fill-opacity'] = fill === "1" ? 1 : 0;
                    if (outline) properties['stroke-opacity'] = outline === "1" ? 1 : 0;
                }
                if (extendedData) {
                    var datas = get(extendedData, 'Data'),
                        simpleDatas = get(extendedData, 'SimpleData');

                    for (i = 0; i < datas.length; i++) {
                        properties[datas[i].getAttribute('name')] = nodeVal(get1(datas[i], 'value'));
                    }
                    for (i = 0; i < simpleDatas.length; i++) {
                        properties[simpleDatas[i].getAttribute('name')] = nodeVal(simpleDatas[i]);
                    }
                }
                if (geomsAndTimes.coordTimes.length) {
                    properties.coordTimes = (geomsAndTimes.coordTimes.length === 1) ?
                        geomsAndTimes.coordTimes[0] : geomsAndTimes.coordTimes;
                }
                var feature = {
                    type: 'Feature',
                    geometry: (geomsAndTimes.geoms.length === 1) ? geomsAndTimes.geoms[0] : {
                        type: 'GeometryCollection',
                        geometries: geomsAndTimes.geoms
                    },
                    properties: properties
                };
                if (attr(root, 'id')) feature.id = attr(root, 'id');
                return [feature];
            }
            return gj;
        },
        gpx: function (doc) {
            var i,
                tracks = get(doc, 'trk'),
                routes = get(doc, 'rte'),
                waypoints = get(doc, 'wpt'),
                // a feature collection
                gj = fc(),
                feature;
            for (i = 0; i < tracks.length; i++) {
                feature = getTrack(tracks[i]);
                if (feature) gj.features.push(feature);
            }
            for (i = 0; i < routes.length; i++) {
                feature = getRoute(routes[i]);
                if (feature) gj.features.push(feature);
            }
            for (i = 0; i < waypoints.length; i++) {
                gj.features.push(getPoint(waypoints[i]));
            }
            function getPoints(node, pointname) {
                var pts = get(node, pointname),
                    line = [],
                    times = [],
                    heartRates = [],
                    l = pts.length;
                if (l < 2) return {};  // Invalid line in GeoJSON
                for (var i = 0; i < l; i++) {
                    var c = coordPair(pts[i]);
                    line.push(c.coordinates);
                    if (c.time) times.push(c.time);
                    if (c.heartRate) heartRates.push(c.heartRate);
                }
                return {
                    line: line,
                    times: times,
                    heartRates: heartRates
                };
            }
            function getTrack(node) {
                var segments = get(node, 'trkseg'),
                    track = [],
                    times = [],
                    heartRates = [],
                    line;
                for (var i = 0; i < segments.length; i++) {
                    line = getPoints(segments[i], 'trkpt');
                    if (line.line) track.push(line.line);
                    if (line.times && line.times.length) times.push(line.times);
                    if (line.heartRates && line.heartRates.length) heartRates.push(line.heartRates);
                }
                if (track.length === 0) return;
                var properties = getProperties(node);
                if (times.length) properties.coordTimes = track.length === 1 ? times[0] : times;
                if (heartRates.length) properties.heartRates = track.length === 1 ? heartRates[0] : heartRates;
                return {
                    type: 'Feature',
                    properties: properties,
                    geometry: {
                        type: track.length === 1 ? 'LineString' : 'MultiLineString',
                        coordinates: track.length === 1 ? track[0] : track
                    }
                };
            }
            function getRoute(node) {
                var line = getPoints(node, 'rtept');
                if (!line) return;
                var routeObj = {
                    type: 'Feature',
                    properties: getProperties(node),
                    geometry: {
                        type: 'LineString',
                        coordinates: line.line
                    }
                };
                return routeObj;
            }
            function getPoint(node) {
                var prop = getProperties(node);
                prop.sym = nodeVal(get1(node, 'sym'));
                return {
                    type: 'Feature',
                    properties: prop,
                    geometry: {
                        type: 'Point',
                        coordinates: coordPair(node).coordinates
                    }
                };
            }
            function getProperties(node) {
                var meta = ['name', 'desc', 'author', 'copyright', 'link',
                            'time', 'keywords'],
                    prop = {},
                    k;
                for (k = 0; k < meta.length; k++) {
                    prop[meta[k]] = nodeVal(get1(node, meta[k]));
                }
                return clean(prop);
            }
            return gj;
        },
        osm: function (xml) {
            function convertToGeoJSON(nodes, ways, rels) {

                // helper function that checks if there are any tags other than "created_by", "source", etc. or any tag provided in ignore_tags
                function has_interesting_tags(t, ignore_tags) {
                    if (typeof ignore_tags !== "object")
                        ignore_tags = {};
                    if (typeof options.uninterestingTags === "function")
                        return !options.uninterestingTags(t, ignore_tags);
                    for (var k in t)
                        if (!(options.uninterestingTags[k] === true) &&
                            !(ignore_tags[k] === true || ignore_tags[k] === t[k]))
                            return true;
                    return false;
                };
                // helper function to extract meta information
                function build_meta_information(object) {
                    var res = {
                        "timestamp": object.timestamp,
                        "version": object.version,
                        "changeset": object.changeset,
                        "user": object.user,
                        "uid": object.uid
                    };
                    for (var k in res)
                        if (res[k] === undefined)
                            delete res[k];
                    return res;
                }

                function construct_multipolygon(tag_object, rel) {
                    var is_tainted = false;
                    // prepare mp members
                    var members;
                    members = rel.members.filter(function (m) { return m.type === "way"; });
                    members = members.map(function (m) {
                        var way = wayids[m.ref];
                        if (way === undefined) { // check for missing ways
                            is_tainted = true;
                            return;
                        }
                        return { // TODO: this is slow! :(
                            id: m.ref,
                            role: m.role || "outer",
                            way: way,
                            nodes: way.nodes.filter(function (n) {
                                if (n !== undefined)
                                    return true;
                                is_tainted = true;
                                return false;
                            })
                        };
                    });
                    members = _.compact(members);
                    // construct outer and inner rings
                    var outers, inners;
                    function join(ways) {
                        var _first = function (arr) { return arr[0] };
                        var _last = function (arr) { return arr[arr.length - 1] };
                        // stolen from iD/relation.js
                        var joined = [], current, first, last, i, how, what;
                        while (ways.length) {
                            current = ways.pop().nodes.slice();
                            joined.push(current);
                            while (ways.length && _first(current) !== _last(current)) {
                                first = _first(current);
                                last = _last(current);
                                for (i = 0; i < ways.length; i++) {
                                    what = ways[i].nodes;
                                    if (last === _first(what)) {
                                        how = current.push;
                                        what = what.slice(1);
                                        break;
                                    } else if (last === _last(what)) {
                                        how = current.push;
                                        what = what.slice(0, -1).reverse();
                                        break;
                                    } else if (first == _last(what)) {
                                        how = current.unshift;
                                        what = what.slice(0, -1);
                                        break;
                                    } else if (first == _first(what)) {
                                        how = current.unshift;
                                        what = what.slice(1).reverse();
                                        break;
                                    } else {
                                        what = how = null;
                                    }
                                }
                                if (!what)
                                    break; // Invalid geometry (dangling way, unclosed ring)
                                ways.splice(i, 1);
                                how.apply(current, what);
                            }
                        }
                        return joined;
                    }
                    outers = join(members.filter(function (m) { return m.role === "outer"; }));
                    inners = join(members.filter(function (m) { return m.role === "inner"; }));
                    // sort rings
                    var mp;
                    function findOuter(inner) {
                        var polygonIntersectsPolygon = function (outer, inner) {
                            for (var i = 0; i < inner.length; i++)
                                if (pointInPolygon(inner[i], outer))
                                    return true;
                            return false;
                        }
                        var mapCoordinates = function (from) {
                            return from.map(function (n) {
                                return [+n.lat, +n.lon];
                            });
                        }
                        // stolen from iD/geo.js, 
                        // based on https://github.com/substack/point-in-polygon, 
                        // ray-casting algorithm based on http://www.ecse.rpi.edu/Homepages/wrf/Research/Short_Notes/pnpoly.html
                        var pointInPolygon = function (point, polygon) {
                            var x = point[0], y = point[1], inside = false;
                            for (var i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
                                var xi = polygon[i][0], yi = polygon[i][1];
                                var xj = polygon[j][0], yj = polygon[j][1];
                                var intersect = ((yi > y) != (yj > y)) &&
                                  (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
                                if (intersect) inside = !inside;
                            }
                            return inside;
                        };
                        // stolen from iD/relation.js
                        var o, outer;
                        // todo: all this coordinate mapping makes this unneccesarily slow.
                        // see the "todo: this is slow! :(" above.
                        inner = mapCoordinates(inner);
                        /*for (o = 0; o < outers.length; o++) {
                          outer = mapCoordinates(outers[o]);
                          if (polygonContainsPolygon(outer, inner))
                            return o;
                        }*/
                        for (o = 0; o < outers.length; o++) {
                            outer = mapCoordinates(outers[o]);
                            if (polygonIntersectsPolygon(outer, inner))
                                return o;
                        }
                    }
                    mp = outers.map(function (o) { return [o]; });
                    for (var j = 0; j < inners.length; j++) {
                        var o = findOuter(inners[j]);
                        if (o !== undefined)
                            mp[o].push(inners[j]);
                        else
                            // so, no outer ring for this inner ring is found.
                            // We're going to ignore holes in empty space.
                            ;
                    }
                    // sanitize mp-coordinates (remove empty clusters or rings, {lat,lon,...} to [lon,lat]
                    var mp_coords = [];
                    mp_coords = _.compact(mp.map(function (cluster) {
                        var cl = _.compact(cluster.map(function (ring) {
                            if (ring.length < 4) // todo: is this correct: ring.length < 4 ?
                                return;
                            return _.compact(ring.map(function (node) {
                                return [+node.lon, +node.lat];
                            }));
                        }));
                        if (cl.length == 0)
                            return;
                        return cl;
                    }));

                    if (mp_coords.length == 0)
                        return false; // ignore multipolygons without coordinates
                    var mp_type = "MultiPolygon";
                    if (mp_coords.length === 1) {
                        mp_type = "Polygon";
                        mp_coords = mp_coords[0];
                    }
                    // mp parsed, now construct the geoJSON
                    var feature = {
                        "type": "Feature",
                        "id": tag_object.type + "/" + tag_object.id,
                        "properties": {
                            "type": tag_object.type,
                            "id": tag_object.id,
                            "tags": tag_object.tags || {},
                            "relations": relsmap[tag_object.type][tag_object.id] || [],
                            "meta": build_meta_information(tag_object)
                        },
                        "geometry": {
                            "type": mp_type,
                            "coordinates": mp_coords,
                        }
                    }
                    if (is_tainted)
                        feature.properties["tainted"] = true;
                    return feature;
                }

                function isPolygonFeature(tags) {
                    var polygonFeatures = options.polygonFeatures;
                    if (typeof polygonFeatures === "function")
                        return polygonFeatures(tags);
                    // explicitely tagged non-areas
                    if (tags['area'] === 'no')
                        return false;
                    // assuming that a typical OSM way has in average less tags than
                    // the polygonFeatures list, this way around should be faster
                    for (var key in tags) {
                        var val = tags[key];
                        var pfk = polygonFeatures[key];
                        // continue with next if tag is unknown or not "categorizing"
                        if (typeof pfk === 'undefined')
                            continue;
                        // continue with next if tag is explicitely un-set ("building=no")
                        if (val === 'no')
                            continue;
                        // check polygon features for: general acceptance, included or excluded values
                        if (pfk === true)
                            return true;
                        if (pfk.included_values && pfk.included_values[val] === true)
                            return true;
                        if (pfk.excluded_values && pfk.excluded_values[val] !== true)
                            return true;
                    }
                    // if no tags matched, this ain't no area. 
                    return false;
                }

                var options = {
                    uninterestingTags: [],
                    polygonFeatures: [],
                };

                // some data processing (e.g. filter nodes only used for ways)
                var nodeids = new Object();
                for (var i = 0; i < nodes.length; i++) {
                    if (nodes[i].lat === undefined)
                        continue; // ignore nodes without coordinates (e.g. returned by an ids_only query)
                    nodeids[nodes[i].id] = nodes[i];
                }
                var poinids = new Object();
                for (var i = 0; i < nodes.length; i++) {
                    if (typeof nodes[i].tags != 'undefined' &&
                        has_interesting_tags(nodes[i].tags)) // this checks if the node has any tags other than "created_by"
                        poinids[nodes[i].id] = true;
                }
                for (var i = 0; i < rels.length; i++) {
                    if (!_.isArray(rels[i].members))
                        continue; // ignore relations without members (e.g. returned by an ids_only query)
                    for (var j = 0; j < rels[i].members.length; j++) {
                        if (rels[i].members[j].type == "node")
                            poinids[rels[i].members[j].ref] = true;
                    }
                }
                var wayids = new Object();
                var waynids = new Object();
                for (var i = 0; i < ways.length; i++) {
                    if (!_.isArray(ways[i].nodes))
                        continue; // ignore ways without nodes (e.g. returned by an ids_only query)
                    wayids[ways[i].id] = ways[i];
                    for (var j = 0; j < ways[i].nodes.length; j++) {
                        waynids[ways[i].nodes[j]] = true;
                        ways[i].nodes[j] = nodeids[ways[i].nodes[j]];
                    }
                }
                var pois = new Array();
                for (var i = 0; i < nodes.length; i++) {
                    if ((!waynids[nodes[i].id]) ||
                        (poinids[nodes[i].id]))
                        pois.push(nodes[i]);
                }
                var relids = new Array();
                for (var i = 0; i < rels.length; i++) {
                    if (!_.isArray(rels[i].members))
                        continue; // ignore relations without members (e.g. returned by an ids_only query)
                    relids[rels[i].id] = rels[i];
                }
                var relsmap = { node: {}, way: {}, relation: {} };
                for (var i = 0; i < rels.length; i++) {
                    if (!_.isArray(rels[i].members))
                        continue; // ignore relations without members (e.g. returned by an ids_only query)
                    for (var j = 0; j < rels[i].members.length; j++) {
                        var m;
                        switch (rels[i].members[j].type) {
                            case "node":
                                m = nodeids[rels[i].members[j].ref];
                                break;
                            case "way":
                                m = wayids[rels[i].members[j].ref];
                                break;
                            case "relation":
                                m = relids[rels[i].members[j].ref];
                                break;
                        }
                        if (!m) continue;
                        var m_type = rels[i].members[j].type;
                        var m_ref = rels[i].members[j].ref;
                        if (typeof relsmap[m_type][m_ref] === "undefined")
                            relsmap[m_type][m_ref] = [];
                        relsmap[m_type][m_ref].push({
                            "role": rels[i].members[j].role,
                            "rel": rels[i].id,
                            "reltags": rels[i].tags,
                        });
                    }
                }
                // construct geojson
                var geojson;
                var geojsonnodes = {
                    "type": "FeatureCollection",
                    "features": new Array()
                };
                for (i = 0; i < pois.length; i++) {
                    if (typeof pois[i].lon == "undefined" || typeof pois[i].lat == "undefined")
                        continue; // lon and lat are required for showing a point
                    geojsonnodes.features.push({
                        "type": "Feature",
                        "id": "node/" + pois[i].id,
                        "properties": {
                            "type": "node",
                            "id": pois[i].id,
                            "tags": pois[i].tags || {},
                            "relations": relsmap["node"][pois[i].id] || [],
                            "meta": build_meta_information(pois[i])
                        },
                        "geometry": {
                            "type": "Point",
                            "coordinates": [+pois[i].lon, +pois[i].lat],
                        }
                    });
                }
                var geojsonlines = {
                    "type": "FeatureCollection",
                    "features": new Array()
                };
                var geojsonpolygons = {
                    "type": "FeatureCollection",
                    "features": new Array()
                };
                // process multipolygons
                for (var i = 0; i < rels.length; i++) {
                    if ((typeof rels[i].tags != "undefined") &&
                        (rels[i].tags["type"] == "multipolygon" || rels[i].tags["type"] == "boundary")) {
                        if (!_.isArray(rels[i].members))
                            continue; // ignore relations without members (e.g. returned by an ids_only query)
                        var outer_count = 0;
                        for (var j = 0; j < rels[i].members.length; j++)
                            if (rels[i].members[j].role == "outer")
                                outer_count++;
                        rels[i].members.forEach(function (m) {
                            if (wayids[m.ref]) {
                                // this even works in the following corner case:
                                // a multipolygon amenity=xxx with outer line tagged amenity=yyy
                                // see https://github.com/tyrasd/osmtogeojson/issues/7
                                if (m.role === "outer" && !has_interesting_tags(wayids[m.ref].tags, rels[i].tags))
                                    wayids[m.ref].is_multipolygon_outline = true;
                                if (m.role === "inner" && !has_interesting_tags(wayids[m.ref].tags))
                                    wayids[m.ref].is_multipolygon_outline = true;
                            }
                        });
                        if (outer_count == 0)
                            continue; // ignore multipolygons without outer ways
                        var simple_mp = false;
                        if (outer_count == 1 && !has_interesting_tags(rels[i].tags, { "type": true }))
                            simple_mp = true;
                        var feature = null;
                        if (!simple_mp) {
                            feature = construct_multipolygon(rels[i], rels[i]);
                        } else {
                            // simple multipolygon
                            var outer_way = rels[i].members.filter(function (m) { return m.role === "outer"; })[0];
                            outer_way = wayids[outer_way.ref];
                            if (outer_way === undefined)
                                continue; // abort if outer way object is not present
                            outer_way.is_multipolygon_outline = true;
                            feature = construct_multipolygon(outer_way, rels[i]);
                        }
                        if (feature === false)
                            continue; // abort if feature could not be constructed
                        geojsonpolygons.features.push(feature);
                        
                    }
                }
                // process lines and polygons
                for (var i = 0; i < ways.length; i++) {
                    if (!_.isArray(ways[i].nodes))
                        continue; // ignore ways without nodes (e.g. returned by an ids_only query)
                    if (ways[i].is_multipolygon_outline)
                        continue; // ignore ways which are already rendered as (part of) a multipolygon
                    ways[i].tainted = false;
                    ways[i].hidden = false;
                    var coords = new Array();
                    for (j = 0; j < ways[i].nodes.length; j++) {
                        if (typeof ways[i].nodes[j] == "object")
                            coords.push([+ways[i].nodes[j].lon, +ways[i].nodes[j].lat]);
                        else
                            ways[i].tainted = true;
                    }
                    if (coords.length <= 1) // invalid way geometry
                        continue;
                    var way_type = "LineString"; // default
                    if (typeof ways[i].nodes[0] != "undefined" && // way has its nodes loaded
                      ways[i].nodes[0] === ways[i].nodes[ways[i].nodes.length - 1] && // ... and forms a closed ring
                      typeof ways[i].tags != "undefined" && // ... and has tags
                      isPolygonFeature(ways[i].tags) // ... and tags say it is a polygon
                    ) {
                        way_type = "Polygon";
                        coords = [coords];
                    }
                    var feature = {
                        "type": "Feature",
                        "id": "way/" + ways[i].id,
                        "properties": {
                            "type": "way",
                            "id": ways[i].id,
                            "tags": ways[i].tags || {},
                            "relations": relsmap["way"][ways[i].id] || [],
                            "meta": build_meta_information(ways[i])
                        },
                        "geometry": {
                            "type": way_type,
                            "coordinates": coords,
                        }
                    }
                    if (ways[i].tainted)
                        feature.properties["tainted"] = true;
                    if (way_type == "LineString")
                        geojsonlines.features.push(feature);
                    else
                        geojsonpolygons.features.push(feature);
                }

                geojson = {
                    "type": "FeatureCollection",
                    "features": []
                };
                geojson.features = geojson.features.concat(geojsonpolygons.features);
                geojson.features = geojson.features.concat(geojsonlines.features);
                geojson.features = geojson.features.concat(geojsonnodes.features);
                // optionally, flatten properties
                if (options.flatProperties) {
                    geojson.features.forEach(function (f) {
                        f.properties = _.merge(
                          f.properties.meta,
                          f.properties.tags,
                          { id: f.properties.type + "/" + f.properties.id }
                        );
                    });
                }
                // fix polygon winding
                //geojson = rewind(geojson, true /*remove for geojson-rewind >0.1.0*/);
                return geojson;
            }

            function copy_attribute(x, o, attr) {
                if (x.hasAttribute(attr))
                    o[attr] = x.getAttribute(attr);
            }
            // sort elements
            var nodes = new Array();
            var ways = new Array();
            var rels = new Array();
            // nodes
            _.each(xml.getElementsByTagName('node'), function (node, i) {
                var tags = {};
                _.each(node.getElementsByTagName('tag'), function (tag) {
                    tags[tag.getAttribute('k')] = tag.getAttribute('v');
                });
                nodes[i] = {
                    'type': 'node'
                };
                copy_attribute(node, nodes[i], 'id');
                copy_attribute(node, nodes[i], 'lat');
                copy_attribute(node, nodes[i], 'lon');
                copy_attribute(node, nodes[i], 'version');
                copy_attribute(node, nodes[i], 'timestamp');
                copy_attribute(node, nodes[i], 'changeset');
                copy_attribute(node, nodes[i], 'uid');
                copy_attribute(node, nodes[i], 'user');
                if (!_.isEmpty(tags))
                    nodes[i].tags = tags;
            });
            // ways
            _.each(xml.getElementsByTagName('way'), function (way, i) {
                var tags = {};
                var wnodes = [];
                _.each(way.getElementsByTagName('tag'), function (tag) {
                    tags[tag.getAttribute('k')] = tag.getAttribute('v');
                });
                _.each(way.getElementsByTagName('nd'), function (nd, i) {
                    wnodes[i] = nd.getAttribute('ref');
                });
                ways[i] = {
                    "type": "way"
                };
                copy_attribute(way, ways[i], 'id');
                copy_attribute(way, ways[i], 'version');
                copy_attribute(way, ways[i], 'timestamp');
                copy_attribute(way, ways[i], 'changeset');
                copy_attribute(way, ways[i], 'uid');
                copy_attribute(way, ways[i], 'user');
                if (wnodes.length > 0)
                    ways[i].nodes = wnodes;
                if (!_.isEmpty(tags))
                    ways[i].tags = tags;
            });
            // relations
            _.each(xml.getElementsByTagName('relation'), function (relation, i) {
                var tags = {};
                var members = [];
                _.each(relation.getElementsByTagName('tag'), function (tag) {
                    tags[tag.getAttribute('k')] = tag.getAttribute('v');
                });
                _.each(relation.getElementsByTagName('member'), function (member, i) {
                    members[i] = {};
                    copy_attribute(member, members[i], 'ref');
                    copy_attribute(member, members[i], 'role');
                    copy_attribute(member, members[i], 'type');
                });
                rels[i] = {
                    "type": "relation"
                }
                copy_attribute(relation, rels[i], 'id');
                copy_attribute(relation, rels[i], 'version');
                copy_attribute(relation, rels[i], 'timestamp');
                copy_attribute(relation, rels[i], 'changeset');
                copy_attribute(relation, rels[i], 'uid');
                copy_attribute(relation, rels[i], 'user');
                if (members.length > 0)
                    rels[i].members = members;
                if (!_.isEmpty(tags))
                    rels[i].tags = tags;
            });
            return convertToGeoJSON(nodes, ways, rels);
        }
    };
    return t;
})();

if (typeof module !== 'undefined') module.exports = toGeoJSON;