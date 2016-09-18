using System.Linq;
using IsraelHiking.API.Gpx;
using IsraelHiking.API.Gpx.GpxTypes;

namespace IsraelHiking.API.Converters.ConverterFlows
{
    public class GpxToSingleTrackGpxConverterFlow : IConverterFlowItem
    {
        public string Input => FlowFormats.GPX_BABEL_FORMAT;
        public string Output => FlowFormats.GPX_SINGLE_TRACK;

        public byte[] Transform(byte[] content)
        {
            var gpx = content.ToGpx();
            var singleTrackGpx = new gpxType
            {
                wpt = gpx.wpt,
                rte = new rteType[0],
                trk = (gpx.trk ?? new trkType[0]).Select(t => new trkType
                {
                    name = t.name,
                    desc = t.desc,
                    cmt = t.cmt,
                    trkseg = new[] { new trksegType { trkpt = (t.trkseg ?? new trksegType[0]).SelectMany(s => s.trkpt).ToArray() } }
                }).ToArray()
            };
            return singleTrackGpx.ToBytes();
        }
    }
}