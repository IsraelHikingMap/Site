using System.Linq;
using IsraelHiking.API.Gpx;

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