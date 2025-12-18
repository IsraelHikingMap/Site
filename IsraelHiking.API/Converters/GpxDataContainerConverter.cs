using IsraelHiking.API.Gpx;
using IsraelHiking.Common;
using IsraelHiking.Common.DataContainer;
using NetTopologySuite.IO;
using System.Collections.Generic;
using System.Linq;

namespace IsraelHiking.API.Converters;

internal class ColorOpacityWeight {
    public string Color { get; init; }
    public double? Opacity { get; init; }
    public int? Weight { get; init; }
}

///<inheritdoc />
public class GpxDataContainerConverter : IGpxDataContainerConverter
{
    /// <summary>
    /// Gpx creator name
    /// </summary>
    public const string MAPEAK = "Mapeak";

    ///<inheritdoc />
    public GpxFile ToGpx(DataContainerPoco container)
    {
        var containerRoutes = container.Routes ?? [];
        var nonEmptyRoutes = containerRoutes.Where(r => r.Segments.SelectMany(s => s.Latlngs).Any());
        var gpx = new GpxFile
        {
            Metadata = new GpxMetadata(MAPEAK),
        };
        gpx.Waypoints.AddRange(containerRoutes.SelectMany(r => r.Markers).Select(ToGpxWaypoint));
        gpx.Tracks.AddRange(nonEmptyRoutes.Select(r => new GpxTrack()
                .WithName(r.Name)
                .WithDescription(r.Description)
                .WithSegments([..r.Segments.Select(ToGpxTrackSegment)])
                .WithExtensions(new ColorOpacityWeight {Color = r.Color, Opacity = r.Opacity, Weight = r.Weight})
            )
        );
        gpx.UpdateBounds();
        return gpx;
    }

    ///<inheritdoc />
    public DataContainerPoco ToDataContainer(GpxFile gpx)
    {
        gpx = gpx.UpdateBounds();
        var container = new DataContainerPoco
        {
            Routes = ConvertRoutesToRoutesData(gpx.Routes ?? [])
        };
        container.Routes.AddRange(ConvertTracksToRouteData(gpx.Tracks ?? []));
        var nonEmptyWayPoints = gpx.Waypoints ?? [];
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
            Segments =
            [
                new RouteSegmentData
                {
                    Latlngs = route.Waypoints.Select(ToLatLngTime).ToList(),
                    RoutePoint = ToLatLng(route.Waypoints.Last())
                }
            ]
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
            Segments = t.Segments.Where(seg => seg?.Waypoints is { Count: > 1 }).Select(seg => new RouteSegmentData
            {
                Latlngs = seg.Waypoints.Select(ToLatLngTime).ToList(),
                RoutePoint = ToLatLng(seg.Waypoints.Last()),
                RoutingType = seg.Extensions as string
            }).ToList(),
        });
        return tracks;
    }

    private void UpdateBoundingBox(DataContainerPoco container, GpxBoundingBox bounds)
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

    private LatLngTime ToLatLngTime(GpxWaypoint point)
    {
        return new LatLngTime
        {
            Lat = point.Latitude,
            Lng = point.Longitude,
            Alt = point.ElevationInMeters,
            Timestamp = point.TimestampUtc?.ToLocalTime()
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
            Urls = point.Links.Select(l => new LinkData { MimeType = l.ContentType, Url = l.HrefString, Text = l.Text })
                .ToList()
        };
    }

    private GpxWaypoint ToGpxWaypoint(MarkerData marker)
    {
        return new GpxWaypoint(
                (GpxLongitude) marker.Latlng.Lng,
                (GpxLatitude) marker.Latlng.Lat)
            .WithName(marker.Title)
            .WithDescription(marker.Description)
            .WithLinks([
                ..(marker.Urls ?? [])
                .Select(l => new GpxWebLink(l.Url, l.Text, l.MimeType))
            ])
            .WithClassification(marker.Type);
    }

    private GpxWaypoint ToGpxWaypoint(LatLngTime latLng)
    {
        var gpxWaypoint = new GpxWaypoint(new GpxLongitude(latLng.Lng), new GpxLatitude(latLng.Lat), latLng.Alt);
        return latLng.Timestamp.HasValue
            ? gpxWaypoint.WithTimestampUtc(latLng.Timestamp.Value.ToUniversalTime())
            : gpxWaypoint;
    }

    private GpxTrackSegment ToGpxTrackSegment(RouteSegmentData segmentData)
    {
        return new GpxTrackSegment(
            waypoints: new ImmutableGpxWaypointTable(segmentData.Latlngs.Select(ToGpxWaypoint)),
            extensions: segmentData.RoutingType
        );
    }
}