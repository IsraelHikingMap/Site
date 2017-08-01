using System.Collections.Generic;
using System.Linq;
using IsraelHiking.API.Gpx;
using IsraelHiking.Common;
using System.Xml;
using NetTopologySuite.IO;

namespace IsraelHiking.API.Converters
{
    internal static class RoutingTypeConverter
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

    ///<inheritdoc />
    public class GpxDataContainerConverter : IGpxDataContainerConverter
    {
        ///<inheritdoc />
        public gpxType ToGpx(DataContainer container)
        {
            var containerRoutes = container.routes ?? new List<RouteData>();
            var nonEmptyRoutes = containerRoutes.Where(r => r.segments.SelectMany(s => s.latlngs).Any());
            return new gpxType
            {
                wpt = containerRoutes.SelectMany(r => r.markers).Select(ToWptType).ToArray(),
                rte = new rteType[0],
                trk = nonEmptyRoutes.Select(r => new trkType
                {
                    name = r.name,
                    desc = r.description,
                    trkseg = r.segments.Select(ToTrksegType).ToArray()
                }).ToArray()
            }.UpdateBounds();
        }

        ///<inheritdoc />
        public DataContainer ToDataContainer(gpxType gpx)
        {
            gpx.UpdateBounds();
            var container = new DataContainer
            {
                routes = ConvertRoutesToRoutesData(gpx.rte ?? new rteType[0])
            };
            container.routes.AddRange(ConvertTracksToRouteData(gpx.trk ?? new trkType[0]));
            var markers = (gpx.wpt ?? new wptType[0]).Select(ToMarkerData).ToList();
            if (markers.Any())
            {
                if (!container.routes.Any())
                {
                    var title = string.IsNullOrWhiteSpace(markers.First().title) ? "Markers" : markers.First().title;
                    var name = markers.Count == 1 ? title : "Markers";
                    container.routes.Add(new RouteData {name = name});
                }
                container.routes.First().markers = markers;
            }
            if (gpx.metadata?.bounds != null)
            {
                UpdateBoundingBox(container, gpx.metadata.bounds);
            }
            return container;
        }

        private List<RouteData> ConvertRoutesToRoutesData(rteType[] routes)
        {
            var routesData = routes.Where(r => r.rtept != null && r.rtept.Any()).Select(route => new RouteData
            {
                name = route.name,
                description = route.desc,
                segments = new List<RouteSegmentData>
                {
                    new RouteSegmentData
                    {
                        latlngs = route.rtept.Select(ToLatLng).ToList(),
                        routePoint = ToLatLng(route.rtept.Last())
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
                description = t.desc,
                segments = t.trkseg.Where(seg => seg?.trkpt != null && seg.trkpt.Length > 1).Select(seg => new RouteSegmentData
                {
                    latlngs = seg.trkpt.Select(ToLatLng).ToList(),
                    routePoint = ToLatLng(seg.trkpt.Last()),
                    routingType = RoutingTypeConverter.FromXml(seg.extensions)
                }).ToList(),
            });
            return tracks;
        }

        private void UpdateBoundingBox(DataContainer container, boundsType bounds)
        {
            container.northEast = new LatLng 
            {
                lat = (double)bounds.maxlat,
                lng = (double)bounds.maxlon
            };

            container.southWest = new LatLng
            {
                lat = (double)bounds.minlat,
                lng = (double)bounds.minlon
            };
        }

        private LatLng ToLatLng(wptType point)
        {
            return new LatLng
            {
                lat = (double)point.lat,
                lng = (double)point.lon,
                alt = (double)point.ele
            };
        }

        private MarkerData ToMarkerData(wptType point)
        {
            return new MarkerData
            {
                latlng = ToLatLng(point),
                title = point.name,
                type = point.type
            };
        }

        private wptType ToWptType(MarkerData marker)
        {
            return new wptType
            {
                lat = (decimal)marker.latlng.lat,
                lon = (decimal)marker.latlng.lng,
                name = marker.title,
                type = marker.type
            };
        }

        private wptType ToWptType(LatLng latLng)
        {
            return new wptType
            {
                lat = (decimal)latLng.lat,
                lon = (decimal)latLng.lng,
                ele = (decimal)(latLng.alt ?? 0),
                eleSpecified = latLng.alt.HasValue
            };
        }

        private trksegType ToTrksegType(RouteSegmentData segmentData)
        {
            return new trksegType
            {
                trkpt = segmentData.latlngs.Select(ToWptType).ToArray(),
                extensions = new extensionsType { Any = new[] { RoutingTypeConverter.ToXml(segmentData.routingType) } }
            };
        }
    }
}
