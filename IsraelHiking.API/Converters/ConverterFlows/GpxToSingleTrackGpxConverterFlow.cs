using System.Collections.Generic;
using System.Collections.Immutable;
using System.Linq;
using IsraelHiking.API.Gpx;
using NetTopologySuite.IO;

namespace IsraelHiking.API.Converters.ConverterFlows
{
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
            var singleTrackGpx = new GpxMainObject
            {
                Waypoints = gpx.Waypoints,
                Routes = new List<GpxRoute>(),
                Tracks = (gpx.Tracks ?? new List<GpxTrack>()).Select(t => new GpxTrack(
                    name: t.Name,
                    description: t.Description,
                    comment: t.Comment,
                    segments: new [] { new GpxTrackSegment(new ImmutableGpxWaypointTable(t.Segments.SelectMany(s => s.Waypoints)), null) }.ToImmutableArray(),
                    source: t.Source,
                    links: t.Links,
                    number: t.Number,
                    classification: t.Classification,
                    extensions: t.Extensions)).ToList()
            };
            return singleTrackGpx.ToBytes();
        }
    }
}