using System;
using System.Collections.Generic;
using System.Collections.Immutable;
using System.Linq;
using IsraelHiking.API.Gpx;
using IsraelHiking.Common;
using NetTopologySuite.IO;

namespace IsraelHiking.API.Converters
{
    internal class ColorOpacityWeight {
        public string Color { get; set; }
        public double? Opacity { get; set; }
        public int? Weight { get; set; }
    }

    ///<inheritdoc />
    public class GpxDataContainerConverter : IGpxDataContainerConverter
    {
        public const string ISRAEL_HIKING_MAP = "IsraelHikingMap";

        ///<inheritdoc />
        public GpxMainObject ToGpx(DataContainer container)
        {
            var containerRoutes = container.Routes ?? new List<RouteData>();
            var nonEmptyRoutes = containerRoutes.Where(r => r.Segments.SelectMany(s => s.Latlngs).Any());
            return new GpxMainObject
            {
                Metadata = new GpxMetadata(ISRAEL_HIKING_MAP),
                Waypoints = containerRoutes.SelectMany(r => r.Markers).Select(ToGpxWaypoint).ToList(),
                Routes = new List<GpxRoute>(),
                Tracks = nonEmptyRoutes.Select(r => new GpxTrack(
                        name: r.Name,
                        comment: null,
                        description: r.Description,
                        source: null,
                        links: ImmutableArray<GpxWebLink>.Empty,
                        number: null,
                        classification: null,
                        segments: r.Segments.Select(ToGpxTraclSegment).ToImmutableArray(),
                        extensions: new ColorOpacityWeight {Color = r.Color, Opacity = r.Opacity, Weight = r.Weight}
                    )
                ).ToList()
            }.UpdateBounds();
        }

        ///<inheritdoc />
        public DataContainer ToDataContainer(GpxMainObject gpx)
        {
            //gpx.UpdateBounds();
            var container = new DataContainer
            {
                Routes = ConvertRoutesToRoutesData(gpx.Routes ?? new List<GpxRoute>())
            };
            container.Routes.AddRange(ConvertTracksToRouteData(gpx.Tracks ?? new List<GpxTrack>()));
            var nonEmptyWayPoints = gpx.Waypoints ?? new List<GpxWaypoint>();
            var markers = nonEmptyWayPoints.Select(ToMarkerData).ToList();
            if (markers.Any())
            {
                if (!container.Routes.Any())
                {
                    var title = string.IsNullOrWhiteSpace(markers.First().Title) ? "Markers" : markers.First().Title;
                    var name = markers.Count == 1 ? title : "Markers";
                    container.Routes.Add(new RouteData {Name = name, Description = nonEmptyWayPoints.First().Description});
                }
                container.Routes.First().Markers = markers;
            }
            if (gpx.Metadata?.Bounds != null)
            {
                UpdateBoundingBox(container, gpx.Metadata.Bounds);
            }
            return container;
        }

        private List<RouteData> ConvertRoutesToRoutesData(IEnumerable<GpxRoute> routes)
        {
            var routesData = routes.Where(r => r.Waypoints != null && r.Waypoints.Any()).Select(route => new RouteData
            {
                Name = route.Name,
                Description = route.Description,
                Segments = new List<RouteSegmentData>
                {
                    new RouteSegmentData
                    {
                        Latlngs = route.Waypoints.Select(ToLatLng).ToList(),
                        RoutePoint = ToLatLng(route.Waypoints.Last())
                    }
                }
            }).ToList();
            return routesData;
        }

        private IEnumerable<RouteData> ConvertTracksToRouteData(IEnumerable<GpxTrack> trks)
        {
            var tracks = trks.Where(t => t.Segments != null && t.Segments.Any()).Select(t => new RouteData
            {
                Name = t.Name,
                Description = t.Description,
                Color = (t.Extensions as ColorOpacityWeight)?.Color,
                Opacity = (t.Extensions as ColorOpacityWeight)?.Opacity,
                Weight = (t.Extensions as ColorOpacityWeight)?.Weight,
                Segments = t.Segments.Where(seg => seg?.Waypoints != null && seg.Waypoints.Count > 1).Select(seg => new RouteSegmentData
                {
                    Latlngs = seg.Waypoints.Select(ToLatLng).ToList(),
                    RoutePoint = ToLatLng(seg.Waypoints.Last()),
                    RoutingType = seg.Extensions as string
                }).ToList(),
            });
            return tracks;
        }

        private void UpdateBoundingBox(DataContainer container, GpxBoundingBox bounds)
        {
            container.NorthEast = new LatLng 
            {
                Lat = bounds.MaxLatitude,
                Lng = bounds.MaxLongitude
            };

            container.SouthWest = new LatLng
            {
                Lat = bounds.MinLatitude,
                Lng = bounds.MinLongitude
            };
        }

        private LatLng ToLatLng(GpxWaypoint point)
        {
            return new LatLng
            {
                Lat = point.Latitude,
                Lng = point.Longitude,
                Alt = point.ElevationInMeters
            };
        }

        private MarkerData ToMarkerData(GpxWaypoint point)
        {
            return new MarkerData
            {
                Latlng = ToLatLng(point),
                Title = point.Name,
                Type = point.Classification,
                Description = point.Description,
                Urls = point.Links.Select(l => new LinkData {MimeType = l.ContentType, Url = l.Href.ToString(), Text = l.Text})
                    .ToList()
            };
        }

        private GpxWaypoint ToGpxWaypoint(MarkerData marker)
        {
            return new GpxWaypoint(
                longitude: new GpxLongitude(marker.Latlng.Lng),
                latitude: new GpxLatitude(marker.Latlng.Lat),
                name: marker.Title,
                description: marker.Description,
                links: (marker.Urls ?? new List<LinkData>()).Select(l => new GpxWebLink(l.Text, l.MimeType, new Uri(l.Url))).ToImmutableArray(),
                classification: marker.Type,
                extensions: null,
                elevationInMeters: null,
                timestampUtc: null,
                symbolText: null,
                magneticVariation: null,
                geoidHeight: null,
                comment: null,
                source: null,
                fixKind: null,
                numberOfSatellites: null,
                horizontalDilutionOfPrecision: null,
                verticalDilutionOfPrecision: null,
                positionDilutionOfPrecision: null,
                secondsSinceLastDgpsUpdate: null,
                dgpsStationId: null
            );
        }

        private GpxWaypoint ToGpxWaypoint(LatLng latLng)
        {
            return new GpxWaypoint(new GpxLongitude(latLng.Lng), new GpxLatitude(latLng.Lat), latLng.Alt);
        }

        private GpxTrackSegment ToGpxTraclSegment(RouteSegmentData segmentData)
        {
            return new GpxTrackSegment(
                waypoints: new ImmutableGpxWaypointTable(segmentData.Latlngs.Select(ToGpxWaypoint)),
                extensions: segmentData.RoutingType
            );
        }
    }
}
