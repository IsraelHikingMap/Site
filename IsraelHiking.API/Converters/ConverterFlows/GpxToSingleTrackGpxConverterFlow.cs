using System.Collections.Generic;
using System.Linq;
using IsraelHiking.API.Gpx;
using NetTopologySuite.IO;

namespace IsraelHiking.API.Converters.ConverterFlows;

///<inheritdoc />
public class GpxToSingleTrackGpxConverterFlow : IConverterFlowItem
{
    ///<inheritdoc />
    public string Input => FlowFormats.GPX_BABEL_FORMAT;
    ///<inheritdoc />
    public string Output => FlowFormats.GPX_SINGLE_TRACK;

    ///<inheritdoc />
    public byte[] Transform(byte[] content)
    {
        var gpx = content.ToGpx();
        var singleTrackGpx = new GpxFile
        {
            Metadata = new GpxMetadata(GpxDataContainerConverter.MAPEAK + "_single_track")
        };
        singleTrackGpx.Waypoints.AddRange(gpx.Waypoints);
        singleTrackGpx.Tracks.AddRange((gpx.Tracks ?? []).Select(t => new GpxTrack(
            name: t.Name,
            description: t.Description,
            comment: t.Comment,
            segments: [..new[] { new GpxTrackSegment(RemoveDuplicatePoints(t.Segments.SelectMany(s => s.Waypoints)), null) }],
            source: t.Source,
            links: t.Links,
            number: t.Number,
            classification: t.Classification,
            extensions: t.Extensions)));
        singleTrackGpx.UpdateBounds();
        return singleTrackGpx.ToBytes();
    }

    /// <summary>
    /// This is a helper function to remove duplicate points from a GPX collection
    /// </summary>
    /// <param name="points"></param>
    /// <returns></returns>
    public static ImmutableGpxWaypointTable RemoveDuplicatePoints(IEnumerable<GpxWaypoint> points)
    {
        var newPoints = new List<GpxWaypoint>();
        if (points.Count() == 0)
        {
            return new ImmutableGpxWaypointTable(newPoints);
        }
        newPoints.Add(points.First());
        foreach (var point in points.Skip(1))
        {
            if (point.Latitude.Value != newPoints.Last().Latitude.Value ||
                point.Longitude.Value != newPoints.Last().Longitude.Value)
            {
                newPoints.Add(point);
            }
        }
        return new ImmutableGpxWaypointTable(newPoints);

    }
}