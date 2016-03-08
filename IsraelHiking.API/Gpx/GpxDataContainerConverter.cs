using System.Collections.Generic;
using System.Linq;
using IsraelHiking.API.Gpx.GpxTypes;
using IsraelHiking.Common;

namespace IsraelHiking.API.Gpx
{
    public class GpxDataContainerConverter : IGpxDataContainerConverter
    {
        public gpxType ToGpx(DataContainer container)
        {
            var markers = container.markers ?? new List<MarkerData>();
            var routes = container.routes ?? new List<RouteData>();
            return new gpxType
            {
                creator = DataContainer.ISRAEL_HIKING_MAP,
                wpt = markers.Select(ToWptType).ToArray(),
                rte = new rteType[0],
                trk = routes.Select(r => new trkType
                {
                    name = r.name,
                    trkseg = r.segments.Select(s => new trksegType
                    {
                        trkpt = s.latlngzs.Select(ToWptType).ToArray(),
                    }).ToArray()
                }).ToArray()
            };
        }

        public DataContainer ToDataContainer(gpxType gpx)
        {
            var container = new DataContainer();
            var points = gpx.wpt ?? new wptType[0];
            container.markers = points.Select(point => new MarkerData { title  = point.name, latlng = ToLatLngZ(point) }).ToList();

            var routes = gpx.rte ?? new rteType[0];
            container.routes = routes.Select(route => new RouteData
            {
                name = route.name,
                segments = new List<RouteSegmentData>
                {
                    new RouteSegmentData
                    {
                        latlngzs = route.rtept.Select(ToLatLngZ).ToList(),
                        routePoint =  ToLatLngZ(route.rtept.Last())
                    }
                }
            }).ToList();

            var trks = gpx.trk ?? new trkType[0];
            var tracks = trks.Where(t => t.trkseg != null && t.trkseg.Any()).Select(t => new RouteData
            {
                name = t.name,
                segments = t.trkseg.Where(seg => seg.trkpt != null && seg.trkpt.Length > 1).Select(seg => new RouteSegmentData
                {
                    latlngzs = seg.trkpt.Select(ToLatLngZ).ToList(),
                    routePoint =  ToLatLngZ(seg.trkpt.Last()),
                    // HM TODO: routing type is incomplete - make this better
                    routingType = "h",
                }).ToList()
            });

            container.routes.AddRange(tracks);

            var allPoints = container.routes.SelectMany(r => r.segments.SelectMany(s => s.latlngzs)).OfType<LatLng>().ToList();
            allPoints.AddRange(container.markers.Select(m => m.latlng));
            if (allPoints.Any() == false)
            {
                return container;
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
            return container;
        }

        private LatLngZ ToLatLngZ(wptType point)
        {
            return new LatLngZ
            {
                lat = (double) point.lat,
                lng = (double) point.lon,
                z = (double) point.ele,
            };
        }

        private wptType ToWptType(MarkerData marker)
        {
            return new wptType
            {
                lat = (decimal) marker.latlng.lat,
                lon = (decimal) marker.latlng.lng,
                name = marker.title,
            };
        }

        private wptType ToWptType(LatLngZ latLngZ)
        {
            return new wptType
            {
                lat = (decimal) latLngZ.lat,
                lon = (decimal) latLngZ.lng,
                ele = (decimal) latLngZ.z,
                eleSpecified = true,
            };
        }
    }
}
