using System.Collections.Generic;
using System.Linq;
using IsraelHiking.API.Gpx;
using IsraelHiking.Common;
using System.Xml;

namespace IsraelHiking.API.Converters
{
    internal abstract class XmlExtensionConverter {

        protected abstract string ElementName { get; }

        public string FromXml(extensionsType extensions)
        {
            return extensions?.Any.FirstOrDefault(a => a.LocalName == ElementName)?.InnerText;
        }

        public XmlElement ToXml(string value)
        {
            var doc = new XmlDocument();
            var element = doc.CreateElement(ElementName);
            element.InnerText = value;
            return element;
        }
    }

    internal class RoutingTypeConverter : XmlExtensionConverter
    {
        protected override string ElementName => "RoutingType";
    }

    internal class ColorConverter : XmlExtensionConverter
    {
        protected override string ElementName => "Color";
    }

    internal class OpacityConverter : XmlExtensionConverter
    {
        protected override string ElementName => "Opacity";
    }

    internal class WeightConverter : XmlExtensionConverter
    {
        protected override string ElementName => "Weight";
    }

    ///<inheritdoc />
    public class GpxDataContainerConverter : IGpxDataContainerConverter
    {
        ///<inheritdoc />
        public gpxType ToGpx(DataContainer container)
        {
            var containerRoutes = container.Routes ?? new List<RouteData>();
            var nonEmptyRoutes = containerRoutes.Where(r => r.Segments.SelectMany(s => s.Latlngs).Any());
            return new gpxType
            {
                wpt = containerRoutes.SelectMany(r => r.Markers).Select(ToWptType).ToArray(),
                rte = new rteType[0],
                trk = nonEmptyRoutes.Select(r => new trkType
                {
                    name = r.Name,
                    desc = r.Description,
                    trkseg = r.Segments.Select(ToTrksegType).ToArray(),
                    extensions = new extensionsType
                    {
                        Any = new[]
                        {
                            new ColorConverter().ToXml(r.Color),
                            new OpacityConverter().ToXml(r.Opacity.ToString()),
                            new WeightConverter().ToXml(r.Weight.ToString())
                        }
                    }
                }).ToArray()
            }.UpdateBounds();
        }

        ///<inheritdoc />
        public DataContainer ToDataContainer(gpxType gpx)
        {
            gpx.UpdateBounds();
            var container = new DataContainer
            {
                Routes = ConvertRoutesToRoutesData(gpx.rte ?? new rteType[0])
            };
            container.Routes.AddRange(ConvertTracksToRouteData(gpx.trk ?? new trkType[0]));
            var nonEmptyWayPoints = gpx.wpt ?? new wptType[0];
            var markers = nonEmptyWayPoints.Select(ToMarkerData).ToList();
            if (markers.Any())
            {
                if (!container.Routes.Any())
                {
                    var title = string.IsNullOrWhiteSpace(markers.First().Title) ? "Markers" : markers.First().Title;
                    var name = markers.Count == 1 ? title : "Markers";
                    container.Routes.Add(new RouteData {Name = name, Description = nonEmptyWayPoints.First().desc});
                }
                container.Routes.First().Markers = markers;
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
                Name = route.name,
                Description = route.desc,
                Segments = new List<RouteSegmentData>
                {
                    new RouteSegmentData
                    {
                        Latlngs = route.rtept.Select(ToLatLng).ToList(),
                        RoutePoint = ToLatLng(route.rtept.Last())
                    }
                }
            }).ToList();
            return routesData;
        }

        private IEnumerable<RouteData> ConvertTracksToRouteData(trkType[] trks)
        {
            var tracks = trks.Where(t => t.trkseg != null && t.trkseg.Any()).Select(t => new RouteData
            {
                Name = t.name,
                Description = t.desc,
                Color = new ColorConverter().FromXml(t.extensions),
                Opacity = string.IsNullOrWhiteSpace(new OpacityConverter().FromXml(t.extensions)) 
                    ? (double?)null 
                    : double.Parse(new OpacityConverter().FromXml(t.extensions)),
                Weight = string.IsNullOrWhiteSpace(new WeightConverter().FromXml(t.extensions))
                    ? (int?)null
                    : int.Parse(new WeightConverter().FromXml(t.extensions)),
                Segments = t.trkseg.Where(seg => seg?.trkpt != null && seg.trkpt.Length > 1).Select(seg => new RouteSegmentData
                {
                    Latlngs = seg.trkpt.Select(ToLatLng).ToList(),
                    RoutePoint = ToLatLng(seg.trkpt.Last()),
                    RoutingType = new RoutingTypeConverter().FromXml(seg.extensions)
                }).ToList(),
            });
            return tracks;
        }

        private void UpdateBoundingBox(DataContainer container, boundsType bounds)
        {
            container.NorthEast = new LatLng 
            {
                Lat = (double)bounds.maxlat,
                Lng = (double)bounds.maxlon
            };

            container.SouthWest = new LatLng
            {
                Lat = (double)bounds.minlat,
                Lng = (double)bounds.minlon
            };
        }

        private LatLng ToLatLng(wptType point)
        {
            return new LatLng
            {
                Lat = (double)point.lat,
                Lng = (double)point.lon,
                Alt = (double)point.ele
            };
        }

        private MarkerData ToMarkerData(wptType point)
        {
            return new MarkerData
            {
                Latlng = ToLatLng(point),
                Title = point.name,
                Type = point.type,
                Description = point.desc,
                Urls = (point.link ?? new linkType[0])
                    .Select(l => new LinkData {MimeType = l.type, Url = l.href, Text = l.text})
                    .ToList()
            };
        }

        private wptType ToWptType(MarkerData marker)
        {
            return new wptType
            {
                lat = (decimal) marker.Latlng.Lat,
                lon = (decimal) marker.Latlng.Lng,
                name = marker.Title,
                desc = marker.Description,
                type = marker.Type,
                link = (marker.Urls ?? new List<LinkData>())
                    .Select(l => new linkType {href = l.Url, text = l.Text, type = l.MimeType}).ToArray()
            };
        }

        private wptType ToWptType(LatLng latLng)
        {
            return new wptType
            {
                lat = (decimal)latLng.Lat,
                lon = (decimal)latLng.Lng,
                ele = (decimal)(latLng.Alt ?? 0),
                eleSpecified = latLng.Alt.HasValue
            };
        }

        private trksegType ToTrksegType(RouteSegmentData segmentData)
        {
            return new trksegType
            {
                trkpt = segmentData.Latlngs.Select(ToWptType).ToArray(),
                extensions = new extensionsType { Any = new[] { new RoutingTypeConverter().ToXml(segmentData.RoutingType) } }
            };
        }
    }
}
