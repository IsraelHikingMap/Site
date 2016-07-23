using System;
using System.Collections.Generic;
using System.Linq;
using System.Xml;
using IsraelHiking.API.Gpx.GpxTypes;
using IsraelHiking.Common;

namespace IsraelHiking.API.Converters
{
    public static class XmlFactory
    {
        public const string ROUTE_ID = "RouteId";
        public const string ROUTING_TYPE = "RoutingType";

        public static XmlElement CreateRouteId(string id)
        {
            var doc = new XmlDocument();
            var element = doc.CreateElement("RouteId");
            element.InnerText = id;
            return element;
        }

        public static XmlElement CreateRoutingType(string type)
        {
            var doc = new XmlDocument();
            var element = doc.CreateElement("RoutingType");
            element.InnerText = type;
            return element;
        }

        public static XmlElement CreateColor(string colorName, string colorHex)
        {
            var doc = new XmlDocument();
            var element = doc.CreateElement("Color");
            element.SetAttribute("name", colorName);
            element.SetAttribute("value", colorHex);
            return element;
        }
    }

    public class GpxDataContainerConverter : IGpxDataContainerConverter
    {
        public gpxType ToGpx(DataContainer container)
        {
            var routes = container.routes ?? new List<RouteData>();
            return new gpxType
            {
                creator = DataContainer.ISRAEL_HIKING_MAP,
                wpt = ConvertRouteDataToWayPoints(routes),
                rte = new rteType[0],
                trk = routes.Select(r => new trkType
                {
                    name = r.name,
                    trkseg = r.segments.Select(ToTrksegType).ToArray(),
                    extensions = new extensionsType { Any = new[] { XmlFactory.CreateRouteId(r.id) } }
                }).ToArray()
            };
        }

        public DataContainer ToDataContainer(gpxType gpx)
        {
            var container = new DataContainer();
            var points = gpx.wpt ?? new wptType[0];
            var pointsPerRoute = points.Where(p => p.extensions != null && p.extensions.Any.Any(e => e.LocalName == XmlFactory.ROUTE_ID)).GroupBy(p => p.extensions.Any.First(a => a.LocalName == XmlFactory.ROUTE_ID).InnerText).ToList();
            var nonRoutePoints = points.Except(pointsPerRoute.SelectMany(g => g.ToList())).Select(ToMarkerData).ToList();

            container.routes = ConvertRoutesToRoutesData(gpx.rte ?? new rteType[0]);
            container.routes.AddRange(ConvertTracksToRouteData(gpx.trk ?? new trkType[0]));

            SetMarkers(container, nonRoutePoints, pointsPerRoute);
            UpdateBoundingBox(container);

            return container;
        }

        private wptType[] ConvertRouteDataToWayPoints(List<RouteData> routes)
        {
            var wayPoints = new List<wptType>();
            foreach (var routeData in routes)
            {
                wayPoints.AddRange(routeData.markers.Select(m => ToWptType(m, routeData.id)));
            }
            return wayPoints.ToArray();
        }

        private List<RouteData> ConvertRoutesToRoutesData(rteType[] routes)
        {
            var routesData = routes.Where(r => r.rtept != null && r.rtept.Any()).Select(route => new RouteData
            {
                name = route.name,
                id = Guid.NewGuid().ToString(),
                segments = new List<RouteSegmentData>
                {
                    new RouteSegmentData
                    {
                        latlngzs = route.rtept.Select(ToLatLngZ).ToList(),
                        routePoint = new MarkerData {latlng = ToLatLngZ(route.rtept.Last())}
                    }
                },
            }).ToList();
            return routesData;
        }

        private IEnumerable<RouteData> ConvertTracksToRouteData(trkType[] trks)
        {
            var tracks = trks.Where(t => t.trkseg != null && t.trkseg.Any()).Select(t => new RouteData
            {
                id = t.extensions?.Any.FirstOrDefault(a => a.LocalName == XmlFactory.ROUTE_ID)?.InnerText ?? Guid.NewGuid().ToString(),
                name = t.name,
                segments = t.trkseg.Where(seg => seg.trkpt != null && seg.trkpt.Length > 1).Select(seg => new RouteSegmentData
                {
                    latlngzs = seg.trkpt.Select(ToLatLngZ).ToList(),
                    routePoint = new MarkerData {latlng = ToLatLngZ(seg.trkpt.Last()), title = seg.trkpt.Last().name},
                    routingType = seg.extensions?.Any.FirstOrDefault(a => a.LocalName == XmlFactory.ROUTING_TYPE)?.InnerText ?? "h",
                }).ToList(),
            });
            return tracks;
        }

        private void SetMarkers(DataContainer container, List<MarkerData> nonRoutePoints, List<IGrouping<string, wptType>> pointsPerRoute)
        {
            foreach (var routeData in container.routes)
            {
                routeData.markers = pointsPerRoute.Where(p => p.Key == routeData.id)
                    .SelectMany(g => g.ToList().Select(ToMarkerData))
                    .ToList();
            }
            if (container.routes.Count == 0 && nonRoutePoints.Count > 0)
            {
                container.routes.Add(new RouteData
                {
                    id = Guid.NewGuid().ToString(),
                    name = "Markers",
                    markers = nonRoutePoints
                });
            }
            else if (nonRoutePoints.Count > 0)
            {
                container.routes.First().markers.AddRange(nonRoutePoints);
            }
            
        }

        private void UpdateBoundingBox(DataContainer container)
        {
            var allPoints = container.routes.SelectMany(r => r.segments.SelectMany(s => s.latlngzs)).OfType<LatLng>().ToList();
            allPoints.AddRange(container.routes.SelectMany(r => r.markers.Select(m => m.latlng)));
            if (allPoints.Any() == false)
            {
                return;
            }
            container.northEast = new LatLngZ
            {
                lat = allPoints.Max(l => l.lat),
                lng = allPoints.Max(l => l.lng)
            };

            container.southWest = new LatLngZ
            {
                lat = allPoints.Min(l => l.lat),
                lng = allPoints.Min(l => l.lng)
            };
        }

        private LatLngZ ToLatLngZ(wptType point)
        {
            return new LatLngZ
            {
                lat = (double)point.lat,
                lng = (double)point.lon,
                z = (double)point.ele,
            };
        }

        private MarkerData ToMarkerData(wptType point)
        {
            return new MarkerData
            {
                latlng = ToLatLngZ(point),
                title = point.name
            };
        }

        private wptType ToWptType(MarkerData marker, string id)
        {
            return new wptType
            {
                lat = (decimal)marker.latlng.lat,
                lon = (decimal)marker.latlng.lng,
                name = marker.title,
                extensions = string.IsNullOrWhiteSpace(id) ? null : new extensionsType { Any = new[] { XmlFactory.CreateRouteId(id) } }
            };
        }

        private wptType ToWptType(LatLngZ latLngZ)
        {
            return new wptType
            {
                lat = (decimal)latLngZ.lat,
                lon = (decimal)latLngZ.lng,
                ele = (decimal)latLngZ.z,
                eleSpecified = true,
            };
        }

        private trksegType ToTrksegType(RouteSegmentData segmentData)
        {
            var segType = new trksegType
            {
                trkpt = segmentData.latlngzs.Select(ToWptType).ToArray(),
                extensions = new extensionsType { Any = new[] { XmlFactory.CreateRoutingType(segmentData.routingType) } }
            };
            if (segmentData.routePoint != null)
            {
                segType.trkpt[segType.trkpt.Length - 1] = ToWptType(segmentData.routePoint, string.Empty);
            }
            return segType;
        }
    }
}
