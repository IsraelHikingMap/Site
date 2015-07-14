!function (e) { "object" == typeof exports ? module.exports = e() : "function" == typeof define && define.amd ? define(e) : "undefined" != typeof window ? window.togpx = e() : "undefined" != typeof global ? global.togpx = e() : "undefined" != typeof self && (self.togpx = e()) }(function () {
    var define, module, exports; return (function e(t, n, r) { function s(o, u) { if (!n[o]) { if (!t[o]) { var a = typeof require == "function" && require; if (!u && a) return a(o, !0); if (i) return i(o, !0); throw new Error("Cannot find module '" + o + "'") } var f = n[o] = { exports: {} }; t[o][0].call(f.exports, function (e) { var n = t[o][1][e]; return s(n ? n : e) }, f, f.exports, e, t, n, r) } return n[o].exports } var i = typeof require == "function" && require; for (var o = 0; o < r.length; o++) s(r[o]); return s })({
        1: [function (require, module, exports) {
            var JXON = require("jxon");

            function togpx(geojson, options) {
                options = (function (defaults, options) {
                    for (var k in defaults) {
                        if (options.hasOwnProperty(k))
                            defaults[k] = options[k];
                    }
                    return defaults;
                })({
                    creator: "togpx",
                    metadata: undefined,
                    featureTitle: get_feature_title,
                    featureDescription: get_feature_description,
                    featureLink: undefined
                }, options || {});

                function get_feature_title(props) {
                    // a simple default heuristic to determine a title for a given feature
                    // uses a nested `tags` object or the feature's `properties` if present
                    // and then searchs for the following properties to construct a title:
                    // `name`, `ref`, `id`
                    if (typeof props.tags === "object") {
                        var tags_title = get_feature_title(props.tags);
                        if (tags_title !== "")
                            return tags_title;
                    }
                    if (props.name)
                        return props.name;
                    if (props.ref)
                        return props.ref;
                    if (props.id)
                        return props.id;
                    return "";
                }
                function get_feature_description(props) {
                    // constructs a description for a given feature
                    // uses a nested `tags` object or the feature's `properties` if present
                    // and then concatenates all properties to construct a description.
                    if (typeof props.tags === "object")
                        return get_feature_description(props.tags);
                    var res = "";
                    for (var k in props) {
                        if (typeof props[k] === "object")
                            continue;
                        res += k + "=" + props[k] + "\n";
                    }
                    return res.substr(0, res.length - 1);
                }
                function add_feature_link(o, f) {
                    if (options.featureLink)
                        o.link = { "@href": options.featureLink(f.properties) }
                }
                // make gpx object
                var gpx = {
                    "gpx": {
                        "@xmlns": "http://www.topografix.com/GPX/1/1",
                        "@xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
                        "@xsi:schemaLocation": "http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd",
                        "@version": "1.1",
                        "wpt": [],
                        "trk": [],
                    }
                };
                if (options.creator)
                    gpx.gpx["@creator"] = options.creator;
                if (options.metadata)
                    gpx.gpx["metadata"] = options.metadata;

                var features;
                if (geojson.type === "FeatureCollection")
                    features = geojson.features;
                else if (geojson.type === "Feature")
                    features = [geojson];
                else
                    features = [{ type: "Feature", properties: {}, geometry: geojson }];
                features.forEach(function mapFeature(f) {
                    switch (f.geometry.type) {
                        // POIs
                        case "Point":
                        case "MultiPoint":
                            var coords = f.geometry.coordinates;
                            if (f.geometry.type == "Point") coords = [coords];
                            coords.forEach(function (coordinates) {
                                o = {
                                    "@lat": coordinates[1],
                                    "@lon": coordinates[0],
                                    "name": options.featureTitle(f.properties),
                                    "desc": options.featureDescription(f.properties)
                                };
                                add_feature_link(o, f);
                                gpx.gpx.wpt.push(o);
                            });
                            break;
                            // LineStrings
                        case "LineString":
                        case "MultiLineString":
                            var coords = f.geometry.coordinates;
                            if (f.geometry.type == "LineString") coords = [coords];
                            o = {
                                "name": options.featureTitle(f.properties),
                                "desc": options.featureDescription(f.properties)
                            };
                            add_feature_link(o, f);
                            o.trkseg = [];
                            coords.forEach(function (coordinates) {
                                var seg = { trkpt: [] };
                                coordinates.forEach(function (c) {
                                    seg.trkpt.push({ "@lat": c[1], "@lon": c[0] });
                                });
                                o.trkseg.push(seg);
                            });
                            gpx.gpx.trk.push(o);
                            break;
                            // Polygons / Multipolygons
                        case "Polygon":
                        case "MultiPolygon":
                            o = {
                                "name": options.featureTitle(f.properties),
                                "desc": options.featureDescription(f.properties)
                            };
                            add_feature_link(o, f);
                            o.trkseg = [];
                            var coords = f.geometry.coordinates;
                            if (f.geometry.type == "Polygon") coords = [coords];
                            coords.forEach(function (poly) {
                                poly.forEach(function (ring) {
                                    var seg = { trkpt: [] };
                                    ring.forEach(function (c) {
                                        seg.trkpt.push({ "@lat": c[1], "@lon": c[0] });
                                    });
                                    o.trkseg.push(seg);
                                });
                            });
                            gpx.gpx.trk.push(o);
                            break;
                        case "GeometryCollection":
                            f.geometry.geometries.forEach(function (geometry) {
                                var pseudo_feature = {
                                    "properties": f.properties,
                                    "geometry": geometry
                                };
                                mapFeature(pseudo_feature);
                            });
                            break;
                        default:
                            console.log("warning: unsupported geometry type: " + f.geometry.type);
                    }
                });
                gpx_str = JXON.stringify(gpx);
                return gpx_str;
            };

            module.exports = togpx;

        }, { "jxon": 2 }], 2: [function (require, module, exports) {
            /*
             * JXON framework - Copyleft 2011 by Mozilla Developer Network
             *
             * https://developer.mozilla.org/en-US/docs/JXON
             *
             * This framework is released under the GNU Public License, version 3 or later.
             * http://www.gnu.org/licenses/gpl-3.0-standalone.html
             *
             * small modifications performed by the iD project:
             * https://github.com/openstreetmap/iD/commits/18aa33ba97b52cacf454e95c65d154000e052a1f/js/lib/jxon.js
             *
             * adapted for nodejs and npm by Martin Raifer <tyr.asd@gmail.com>
             */

            if (typeof XMLSerializer === 'undefined') {
                XMLSerializer = require("xmldom").XMLSerializer;
                document = {};
                document.implementation = new (require("xmldom").DOMImplementation)();
            }

            var JXON = new (function () {
                var
                  sValueProp = "keyValue", sAttributesProp = "keyAttributes", sAttrPref = "@", /* you can customize these values */
                  aCache = [], rIsNull = /^\s*$/, rIsBool = /^(?:true|false)$/i;

                function parseText(sValue) {
                    if (rIsNull.test(sValue)) { return null; }
                    if (rIsBool.test(sValue)) { return sValue.toLowerCase() === "true"; }
                    if (isFinite(sValue)) { return parseFloat(sValue); }
                    if (isFinite(Date.parse(sValue))) { return new Date(sValue); }
                    return sValue;
                }

                function EmptyTree() { }
                EmptyTree.prototype.toString = function () { return "null"; };
                EmptyTree.prototype.valueOf = function () { return null; };

                function objectify(vValue) {
                    return vValue === null ? new EmptyTree() : vValue instanceof Object ? vValue : new vValue.constructor(vValue);
                }

                function createObjTree(oParentNode, nVerb, bFreeze, bNesteAttr) {
                    var
                      nLevelStart = aCache.length, bChildren = oParentNode.hasChildNodes(),
                      bAttributes = oParentNode.hasAttributes(), bHighVerb = Boolean(nVerb & 2);

                    var
                      sProp, vContent, nLength = 0, sCollectedTxt = "",
                      vResult = bHighVerb ? {} : /* put here the default value for empty nodes: */ true;

                    if (bChildren) {
                        for (var oNode, nItem = 0; nItem < oParentNode.childNodes.length; nItem++) {
                            oNode = oParentNode.childNodes.item(nItem);
                            if (oNode.nodeType === 4) { sCollectedTxt += oNode.nodeValue; } /* nodeType is "CDATASection" (4) */
                            else if (oNode.nodeType === 3) { sCollectedTxt += oNode.nodeValue.trim(); } /* nodeType is "Text" (3) */
                            else if (oNode.nodeType === 1 && !oNode.prefix) { aCache.push(oNode); } /* nodeType is "Element" (1) */
                        }
                    }

                    var nLevelEnd = aCache.length, vBuiltVal = parseText(sCollectedTxt);

                    if (!bHighVerb && (bChildren || bAttributes)) { vResult = nVerb === 0 ? objectify(vBuiltVal) : {}; }

                    for (var nElId = nLevelStart; nElId < nLevelEnd; nElId++) {
                        sProp = aCache[nElId].nodeName.toLowerCase();
                        vContent = createObjTree(aCache[nElId], nVerb, bFreeze, bNesteAttr);
                        if (vResult.hasOwnProperty(sProp)) {
                            if (vResult[sProp].constructor !== Array) { vResult[sProp] = [vResult[sProp]]; }
                            vResult[sProp].push(vContent);
                        } else {
                            vResult[sProp] = vContent;
                            nLength++;
                        }
                    }

                    if (bAttributes) {
                        var
                          nAttrLen = oParentNode.attributes.length,
                          sAPrefix = bNesteAttr ? "" : sAttrPref, oAttrParent = bNesteAttr ? {} : vResult;

                        for (var oAttrib, nAttrib = 0; nAttrib < nAttrLen; nLength++, nAttrib++) {
                            oAttrib = oParentNode.attributes.item(nAttrib);
                            oAttrParent[sAPrefix + oAttrib.name.toLowerCase()] = parseText(oAttrib.value.trim());
                        }

                        if (bNesteAttr) {
                            if (bFreeze) { Object.freeze(oAttrParent); }
                            vResult[sAttributesProp] = oAttrParent;
                            nLength -= nAttrLen - 1;
                        }
                    }

                    if (nVerb === 3 || (nVerb === 2 || nVerb === 1 && nLength > 0) && sCollectedTxt) {
                        vResult[sValueProp] = vBuiltVal;
                    } else if (!bHighVerb && nLength === 0 && sCollectedTxt) {
                        vResult = vBuiltVal;
                    }

                    if (bFreeze && (bHighVerb || nLength > 0)) { Object.freeze(vResult); }

                    aCache.length = nLevelStart;

                    return vResult;
                }

                function loadObjTree(oXMLDoc, oParentEl, oParentObj) {
                    var vValue, oChild;

                    if (oParentObj instanceof String || oParentObj instanceof Number || oParentObj instanceof Boolean) {
                        oParentEl.appendChild(oXMLDoc.createTextNode(oParentObj.toString())); /* verbosity level is 0 */
                    } else if (oParentObj.constructor === Date) {
                        oParentEl.appendChild(oXMLDoc.createTextNode(oParentObj.toGMTString()));
                    }

                    for (var sName in oParentObj) {
                        vValue = oParentObj[sName];
                        if (isFinite(sName) || vValue instanceof Function) { continue; } /* verbosity level is 0 */
                        if (sName === sValueProp) {
                            if (vValue !== null && vValue !== true) { oParentEl.appendChild(oXMLDoc.createTextNode(vValue.constructor === Date ? vValue.toGMTString() : String(vValue))); }
                        } else if (sName === sAttributesProp) { /* verbosity level is 3 */
                            for (var sAttrib in vValue) { oParentEl.setAttribute(sAttrib, vValue[sAttrib]); }
                        } else if (sName.charAt(0) === sAttrPref) {
                            oParentEl.setAttribute(sName.slice(1), vValue);
                        } else if (vValue.constructor === Array) {
                            for (var nItem = 0; nItem < vValue.length; nItem++) {
                                oChild = oXMLDoc.createElement(sName);
                                loadObjTree(oXMLDoc, oChild, vValue[nItem]);
                                oParentEl.appendChild(oChild);
                            }
                        } else {
                            oChild = oXMLDoc.createElement(sName);
                            if (vValue instanceof Object) {
                                loadObjTree(oXMLDoc, oChild, vValue);
                            } else if (vValue !== null && vValue !== true) {
                                oChild.appendChild(oXMLDoc.createTextNode(vValue.toString()));
                            }
                            oParentEl.appendChild(oChild);
                        }
                    }
                }

                this.build = function (oXMLParent, nVerbosity /* optional */, bFreeze /* optional */, bNesteAttributes /* optional */) {
                    var _nVerb = arguments.length > 1 && typeof nVerbosity === "number" ? nVerbosity & 3 : /* put here the default verbosity level: */ 1;
                    return createObjTree(oXMLParent, _nVerb, bFreeze || false, arguments.length > 3 ? bNesteAttributes : _nVerb === 3);
                };

                this.unbuild = function (oObjTree) {
                    var oNewDoc = document.implementation.createDocument("", "", null);
                    loadObjTree(oNewDoc, oNewDoc, oObjTree);
                    return oNewDoc;
                };

                this.stringify = function (oObjTree) {
                    return (new XMLSerializer()).serializeToString(JXON.unbuild(oObjTree));
                };
            })();

            module.exports = JXON;
        }, { "xmldom": 3 }], 3: [function (require, module, exports) {

        }, {}]
    }, {}, [1])
    (1)
});
;