using System.Collections.Generic;
using System.Linq;
using System.Xml;
using IsraelHiking.API.Gpx.GpxTypes;
using IsraelHiking.Common;

namespace IsraelHiking.API.Converters
{
    public static class RoutingTypeConverter
    {
        private const string ROUTING_TYPE = "RoutingType";

        public static string FromXml(extensionsType extensions)
        {
            return extensions?.Any.FirstOrDefault(a => a.LocalName == ROUTING_TYPE)?.InnerText;
        }

        public static XmlElement ToXml(string type)
        {
            var doc = new XmlDocument();
            var element = doc.CreateElement(ROUTING_TYPE);
            element.InnerText = type;
            return element;
        }
    }

    public class GpxDataContainerConverter : IGpxDataContainerConverter
    {
        public gpxType ToGpx(DataContainer container)
        {
            var routes = (container.routes ?? new List<RouteData>()).Where(r => r.segments.SelectMany(s => s.latlngzs).Any());
            return new gpxType
            {
                wpt = container.markers.Select(ToWptType).ToArray(),
                rte = new rteType[0],
                trk = routes.Select(r => new trkType
                {
                    name = r.name,
                    trkseg = r.segments.Select(ToTrksegType).ToArray()
                }).ToArray()
            };
        }

        public DataContainer ToDataContainer(gpxType gpx)
        {
            var container = new DataContainer
            {
                markers = (gpx.wpt ?? new wptType[0]).Select(ToMarkerData).ToList(),
                routes = ConvertRoutesToRoutesData(gpx.rte ?? new rteType[0])
            };
            container.routes.AddRange(ConvertTracksToRouteData(gpx.trk ?? new trkType[0]));
            UpdateBoundingBox(container);

            return container;
        }

        private List<RouteData> ConvertRoutesToRoutesData(rteType[] routes)
        {
            var routesData = routes.Where(r => r.rtept != null && r.rtept.Any()).Select(route => new RouteData
            {
                name = route.name,
                segments = new List<RouteSegmentData>
                {
                    new RouteSegmentData
                    {
                        latlngzs = route.rtept.Select(ToLatLngZ).ToList(),
                        routePoint = ToLatLngZ(route.rtept.Last())
                    }
                }
            }).ToList();
            return routesData;
        }

        private IEnumerable<RouteData> ConvertTracksToRouteData(trkType[] trks)
        {
            var tracks = trks.Where(t => t.trkseg != null && t.trkseg.Any()).Select(t => new RouteData
            {
                name = t.name,
                segments = t.trkseg.Where(seg => seg.trkpt != null && seg.trkpt.Length > 1).Select(seg => new RouteSegmentData
                {
                    latlngzs = seg.trkpt.Select(ToLatLngZ).ToList(),
                    routePoint = ToLatLngZ(seg.trkpt.Last()),
                    routingType = RoutingTypeConverter.FromXml(seg.extensions)
                }).ToList(),
            });
            return tracks;
        }

        private void UpdateBoundingBox(DataContainer container)
        {
            var allPoints = container.routes.SelectMany(r => r.segments.SelectMany(s => s.latlngzs)).OfType<LatLng>().ToList();
            allPoints.AddRange(container.markers.Select(m => m.latlng));
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
                z = (double)point.ele
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

        private wptType ToWptType(MarkerData marker)
        {
            return new wptType
            {
                lat = (decimal)marker.latlng.lat,
                lon = (decimal)marker.latlng.lng,
                name = marker.title
            };
        }

        private wptType ToWptType(LatLngZ latLngZ)
        {
            return new wptType
            {
                lat = (decimal)latLngZ.lat,
                lon = (decimal)latLngZ.lng,
                ele = (decimal)latLngZ.z,
                eleSpecified = true
            };
        }

        private trksegType ToTrksegType(RouteSegmentData segmentData)
        {
            return new trksegType
            {
                trkpt = segmentData.latlngzs.Select(ToWptType).ToArray(),
                extensions = new extensionsType { Any = new[] { RoutingTypeConverter.ToXml(segmentData.routingType) } }
            };
        }
    }
}
